//! F4 리스크 규칙 엔진 — 감정 배제 기계적 판정 (순수 함수, 무상태).
//! Stop-Loss · Trailing Stop · Take-Profit · 일일 최대손실 · 포지션 사이징 · Fail-Safe.

use serde::{Deserialize, Serialize};

/// 리스크 판정 입력 — 포지션 상태 + 페르소나별 규칙 파라미터.
#[derive(Debug, Clone, Deserialize)]
pub struct RiskRequest {
    pub ticker: String,
    pub entry_price: f64,
    pub current_price: f64,
    /// 보유 후 갱신된 최고가 (Trailing Stop 기준). 없으면 entry_price 사용.
    #[serde(default)]
    pub highest_price: f64,
    /// 현재 단일 종목 비중 (0.0~1.0).
    #[serde(default)]
    pub position_pct: f64,
    /// 당일 누적 손익률 (예: -0.04 = -4%).
    #[serde(default)]
    pub account_pnl_pct: f64,

    // ── 규칙 파라미터 (페르소나별 설정) ──
    pub stop_loss_pct: f64,       // 예: 0.02 = -2%
    #[serde(default)]
    pub trailing_pct: f64,        // 0 이면 비활성
    #[serde(default)]
    pub take_profit_pct: f64,     // 0 이면 비활성
    pub daily_loss_limit_pct: f64, // 예: 0.05 = -5%
    pub max_position_pct: f64,    // 예: 0.10 = 10%

    /// 브로커 세션 연결 상태. false → Fail-Safe.
    #[serde(default = "default_true")]
    pub broker_connected: bool,

    // ── Phase B 추가 필드 ──
    /// KRX 시장경보 레벨. 0=정상, 1=투자주의, 2=투자경고, 3=투자위험/정리매매.
    #[serde(default)]
    pub market_alert_level: u8,
    /// 공매도 비율 (0.0~1.0). 0 이면 비활성.
    #[serde(default)]
    pub short_ratio: f64,
    /// 공매도 비율 임계치. 0 이면 규칙 비활성.
    #[serde(default)]
    pub short_ratio_limit: f64,

    // ── F8 펀더멘털 리스크 규칙 ──
    /// 현재 PER. per_max > 0 && per > per_max → BlockBuy (고평가).
    #[serde(default)]
    pub per: f64,
    #[serde(default)]
    pub per_max: f64,
    /// 현재 PBR. pbr_max > 0 && pbr > pbr_max → BlockBuy.
    #[serde(default)]
    pub pbr: f64,
    #[serde(default)]
    pub pbr_max: f64,
    /// 현재 ROE (%). roe_min != 0 && roe < roe_min → ReducePosition (수익성 저조).
    #[serde(default)]
    pub roe: f64,
    #[serde(default)]
    pub roe_min: f64,
    /// 현재 부채비율 (%). debt_ratio_max > 0 && debt_ratio > max → BlockBuy.
    #[serde(default)]
    pub debt_ratio: f64,
    #[serde(default)]
    pub debt_ratio_max: f64,
    /// 현재 RSI. rsi_overbought > 0 && rsi > rsi_overbought → ReducePosition.
    #[serde(default)]
    pub rsi: f64,
    #[serde(default)]
    pub rsi_overbought: f64,
    /// 이동평균 데드크로스 (단기 < 장기). true → BlockBuy.
    #[serde(default)]
    pub ma_death_cross: bool,
    /// 거래량 급감 (평균 대비 임계치 미달). true → BlockBuy (유동성 위험).
    #[serde(default)]
    pub volume_collapse: bool,
}

fn default_true() -> bool {
    true
}

/// 최종 조치. 우선순위: ForceSell > BlockBuy > ReducePosition > Hold.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    /// 즉시 시장가 전량 매도 (Stop-Loss / Trailing / 일일한도 청산).
    ForceSell,
    /// 익절 분할 매도.
    TakeProfit,
    /// 신규 매수 차단 (Fail-Safe / 일일한도).
    BlockBuy,
    /// 비중 초과 → 축소.
    ReducePosition,
    /// 조치 없음.
    Hold,
}

#[derive(Debug, Clone, Serialize)]
pub struct RiskDecision {
    pub ticker: String,
    pub action: Action,
    /// 발동된 규칙 식별자 목록 (감사 로그용).
    pub triggered: Vec<String>,
    pub reason: String,
}

/// 리스크 판정 — 모든 규칙 평가 후 최고 우선순위 조치 반환.
pub fn evaluate(req: &RiskRequest) -> RiskDecision {
    let mut triggered: Vec<String> = Vec::new();
    let mut reasons: Vec<String> = Vec::new();

    let highest = if req.highest_price > 0.0 {
        req.highest_price
    } else {
        req.entry_price
    };

    // 1) Fail-Safe — 브로커 세션 유실 → 신규 진입 차단 (NFR).
    if !req.broker_connected {
        triggered.push("fail_safe".into());
        reasons.push("브로커 세션 유실 — 신규 매수 전면 차단".into());
    }

    // 2) Stop-Loss — 매수단가 대비 손절선 도달 → 즉시 매도.
    let stop_line = req.entry_price * (1.0 - req.stop_loss_pct);
    if req.current_price <= stop_line {
        triggered.push("stop_loss".into());
        reasons.push(format!(
            "Stop-Loss: {:.2} <= {:.2} (-{:.1}%)",
            req.current_price, stop_line, req.stop_loss_pct * 100.0
        ));
    }

    // 3) Trailing Stop — 최고가 대비 하락폭 도달 → 즉시 매도.
    if req.trailing_pct > 0.0 {
        let trail_line = highest * (1.0 - req.trailing_pct);
        if req.current_price <= trail_line && highest > req.entry_price {
            triggered.push("trailing_stop".into());
            reasons.push(format!(
                "Trailing Stop: {:.2} <= {:.2} (최고가 {:.2} 대비 -{:.1}%)",
                req.current_price, trail_line, highest, req.trailing_pct * 100.0
            ));
        }
    }

    // 4) 일일 최대손실 한도 — 초과 시 신규 매수 차단 + 단계 청산.
    if req.account_pnl_pct <= -req.daily_loss_limit_pct {
        triggered.push("daily_loss_limit".into());
        reasons.push(format!(
            "일일 손실 한도: {:.1}% <= -{:.1}%",
            req.account_pnl_pct * 100.0, req.daily_loss_limit_pct * 100.0
        ));
    }

    // 5) Take-Profit — 목표 수익 도달 → 분할/전량 익절.
    if req.take_profit_pct > 0.0 {
        let tp_line = req.entry_price * (1.0 + req.take_profit_pct);
        if req.current_price >= tp_line {
            triggered.push("take_profit".into());
            reasons.push(format!(
                "Take-Profit: {:.2} >= {:.2} (+{:.1}%)",
                req.current_price, tp_line, req.take_profit_pct * 100.0
            ));
        }
    }

    // 6) 포지션 사이징 — 단일 종목 한도 초과 → 축소.
    if req.position_pct > req.max_position_pct {
        triggered.push("position_sizing".into());
        reasons.push(format!(
            "포지션 한도 초과: {:.1}% > {:.1}%",
            req.position_pct * 100.0, req.max_position_pct * 100.0
        ));
    }

    // 7) Phase B-2: KRX 시장경보 — 위험/정리매매(3) → 긴급청산, 경고(2) → 신규매수 차단.
    if req.market_alert_level >= 3 {
        triggered.push("market_alert_danger".into());
        reasons.push(format!(
            "시장경보 위험(레벨 {}) — 긴급청산 트리거",
            req.market_alert_level
        ));
    } else if req.market_alert_level == 2 {
        triggered.push("market_alert_warning".into());
        reasons.push("시장경보 경고(레벨 2) — 신규 매수 차단".into());
    }

    // 8) Phase B-4: 공매도 과열 — 비율 임계치 초과 시 포지션 축소.
    if req.short_ratio_limit > 0.0 && req.short_ratio > req.short_ratio_limit {
        triggered.push("short_sell_excess".into());
        reasons.push(format!(
            "공매도 과열: {:.1}% > {:.1}% 임계치 — 포지션 축소",
            req.short_ratio * 100.0, req.short_ratio_limit * 100.0
        ));
    }

    // ── F8 펀더멘털 리스크 규칙 ──

    // 9) PER 고평가 — 수익 대비 주가 배수 초과 시 신규 매수 차단.
    if req.per_max > 0.0 && req.per > 0.0 && req.per > req.per_max {
        triggered.push("per_overvalued".into());
        reasons.push(format!("PER 고평가: {:.1}x > {:.1}x 한도 — 신규 매수 차단", req.per, req.per_max));
    }

    // 10) PBR 고평가 — 자산 대비 주가 배수 초과 시 신규 매수 차단.
    if req.pbr_max > 0.0 && req.pbr > 0.0 && req.pbr > req.pbr_max {
        triggered.push("pbr_overvalued".into());
        reasons.push(format!("PBR 고평가: {:.2}x > {:.2}x 한도 — 신규 매수 차단", req.pbr, req.pbr_max));
    }

    // 11) 부채비율 과다 — 재무 레버리지 임계치 초과 시 신규 매수 차단.
    if req.debt_ratio_max > 0.0 && req.debt_ratio > req.debt_ratio_max {
        triggered.push("debt_ratio_excess".into());
        reasons.push(format!("부채비율 과다: {:.1}% > {:.1}% 한도 — 신규 매수 차단", req.debt_ratio, req.debt_ratio_max));
    }

    // 12) ROE 저조 — 자기자본이익률 기준 미달 시 포지션 축소.
    if req.roe_min != 0.0 && req.roe < req.roe_min {
        triggered.push("roe_weak".into());
        reasons.push(format!("ROE 저조: {:.1}% < {:.1}% 기준 — 포지션 축소", req.roe, req.roe_min));
    }

    // 13) RSI 과매수 — 기술적 과열 시 포지션 축소.
    if req.rsi_overbought > 0.0 && req.rsi > req.rsi_overbought {
        triggered.push("rsi_overbought".into());
        reasons.push(format!("RSI 과매수: {:.1} > {:.1} — 포지션 축소", req.rsi, req.rsi_overbought));
    }

    // 14) 이동평균 데드크로스 — 단기선이 장기선 하향 돌파, 하락 추세 신규 매수 차단.
    if req.ma_death_cross {
        triggered.push("ma_death_cross".into());
        reasons.push("이동평균 데드크로스(단기 < 장기) — 하락 추세 신규 매수 차단".into());
    }

    // 15) 거래량 급감 — 유동성 위험 신규 매수 차단.
    if req.volume_collapse {
        triggered.push("volume_collapse".into());
        reasons.push("거래량 급감 — 유동성 위험 신규 매수 차단".into());
    }

    // ── 우선순위 결정 ──
    let has = |k: &str| triggered.iter().any(|t| t == k);
    let action = if has("stop_loss") || has("trailing_stop") || has("daily_loss_limit") || has("market_alert_danger") {
        Action::ForceSell
    } else if has("take_profit") {
        Action::TakeProfit
    } else if has("fail_safe") || has("market_alert_warning")
        || has("per_overvalued") || has("pbr_overvalued") || has("debt_ratio_excess")
        || has("ma_death_cross") || has("volume_collapse") {
        Action::BlockBuy
    } else if has("position_sizing") || has("short_sell_excess") || has("roe_weak") || has("rsi_overbought") {
        Action::ReducePosition
    } else {
        Action::Hold
    };

    let reason = if reasons.is_empty() {
        "모든 리스크 규칙 통과".into()
    } else {
        reasons.join(" | ")
    };

    RiskDecision {
        ticker: req.ticker.clone(),
        action,
        triggered,
        reason,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base() -> RiskRequest {
        RiskRequest {
            ticker: "005930".into(),
            entry_price: 70000.0,
            current_price: 70000.0,
            highest_price: 0.0,
            position_pct: 0.05,
            account_pnl_pct: 0.0,
            stop_loss_pct: 0.02,
            trailing_pct: 0.0,
            take_profit_pct: 0.0,
            daily_loss_limit_pct: 0.05,
            max_position_pct: 0.10,
            broker_connected: true,
            market_alert_level: 0,
            short_ratio: 0.0,
            short_ratio_limit: 0.0,
            // F8 펀더멘털 — 기본값 비활성
            per: 0.0, per_max: 0.0,
            pbr: 0.0, pbr_max: 0.0,
            roe: 0.0, roe_min: 0.0,
            debt_ratio: 0.0, debt_ratio_max: 0.0,
            rsi: 0.0, rsi_overbought: 0.0,
            ma_death_cross: false,
            volume_collapse: false,
        }
    }

    #[test]
    fn hold_when_all_pass() {
        let d = evaluate(&base());
        assert_eq!(d.action, Action::Hold);
        assert!(d.triggered.is_empty());
    }

    #[test]
    fn stop_loss_triggers_force_sell() {
        let mut r = base();
        r.current_price = 68600.0; // -2% 정확히
        let d = evaluate(&r);
        assert_eq!(d.action, Action::ForceSell);
        assert!(d.triggered.contains(&"stop_loss".to_string()));
    }

    #[test]
    fn stop_loss_not_triggered_above_line() {
        let mut r = base();
        r.current_price = 69000.0; // -1.4%, 손절선 위
        let d = evaluate(&r);
        assert_eq!(d.action, Action::Hold);
    }

    #[test]
    fn trailing_stop_protects_profit() {
        let mut r = base();
        r.current_price = 75000.0;
        r.highest_price = 80000.0;
        r.trailing_pct = 0.05; // 최고가 -5% = 76000
        let d = evaluate(&r);
        assert_eq!(d.action, Action::ForceSell);
        assert!(d.triggered.contains(&"trailing_stop".to_string()));
    }

    #[test]
    fn trailing_ignored_when_below_entry() {
        let mut r = base();
        r.current_price = 69000.0;
        r.highest_price = 69500.0; // 진입가 미만 → 트레일링 무시
        r.trailing_pct = 0.01;
        let d = evaluate(&r);
        assert!(!d.triggered.contains(&"trailing_stop".to_string()));
    }

    #[test]
    fn take_profit_triggers() {
        let mut r = base();
        r.current_price = 77000.0;
        r.take_profit_pct = 0.10; // +10% = 77000
        let d = evaluate(&r);
        assert_eq!(d.action, Action::TakeProfit);
    }

    #[test]
    fn daily_loss_limit_blocks() {
        let mut r = base();
        r.account_pnl_pct = -0.05;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::ForceSell);
        assert!(d.triggered.contains(&"daily_loss_limit".to_string()));
    }

    #[test]
    fn fail_safe_blocks_buy() {
        let mut r = base();
        r.broker_connected = false;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::BlockBuy);
        assert!(d.triggered.contains(&"fail_safe".to_string()));
    }

    #[test]
    fn position_sizing_reduces() {
        let mut r = base();
        r.position_pct = 0.15; // 한도 10% 초과
        let d = evaluate(&r);
        assert_eq!(d.action, Action::ReducePosition);
    }

    #[test]
    fn stop_loss_priority_over_position_sizing() {
        let mut r = base();
        r.current_price = 68000.0; // stop-loss 발동
        r.position_pct = 0.15;     // 사이징도 발동
        let d = evaluate(&r);
        assert_eq!(d.action, Action::ForceSell); // 청산이 우선
        assert_eq!(d.triggered.len(), 2);
    }

    // Phase B-2: 시장경보 규칙
    #[test]
    fn market_alert_danger_force_sell() {
        let mut r = base();
        r.market_alert_level = 3;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::ForceSell);
        assert!(d.triggered.contains(&"market_alert_danger".to_string()));
    }

    #[test]
    fn market_alert_level4_also_danger() {
        let mut r = base();
        r.market_alert_level = 4; // 정리매매
        let d = evaluate(&r);
        assert_eq!(d.action, Action::ForceSell);
    }

    #[test]
    fn market_alert_warning_blocks_buy() {
        let mut r = base();
        r.market_alert_level = 2;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::BlockBuy);
        assert!(d.triggered.contains(&"market_alert_warning".to_string()));
    }

    #[test]
    fn market_alert_caution_no_action() {
        let mut r = base();
        r.market_alert_level = 1; // 투자주의는 규칙 미발동
        let d = evaluate(&r);
        assert_eq!(d.action, Action::Hold);
    }

    #[test]
    fn market_alert_zero_normal() {
        let r = base(); // market_alert_level = 0 (default)
        let d = evaluate(&r);
        assert_eq!(d.action, Action::Hold);
    }

    // Phase B-4: 공매도 과열 규칙
    #[test]
    fn short_sell_excess_reduces_position() {
        let mut r = base();
        r.short_ratio = 0.25;
        r.short_ratio_limit = 0.20;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::ReducePosition);
        assert!(d.triggered.contains(&"short_sell_excess".to_string()));
    }

    #[test]
    fn short_sell_below_limit_no_action() {
        let mut r = base();
        r.short_ratio = 0.10;
        r.short_ratio_limit = 0.20;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::Hold);
    }

    #[test]
    fn short_sell_limit_zero_disabled() {
        let mut r = base();
        r.short_ratio = 0.99; // 한도 0 → 규칙 비활성
        r.short_ratio_limit = 0.0;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::Hold);
    }

    #[test]
    fn market_alert_danger_overrides_short_sell() {
        let mut r = base();
        r.market_alert_level = 3;
        r.short_ratio = 0.99;
        r.short_ratio_limit = 0.10;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::ForceSell);
    }

    // F8: 펀더멘털 규칙
    #[test]
    fn per_overvalued_blocks_buy() {
        let mut r = base();
        r.per = 55.0;
        r.per_max = 30.0;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::BlockBuy);
        assert!(d.triggered.contains(&"per_overvalued".to_string()));
    }

    #[test]
    fn per_disabled_when_per_max_zero() {
        let mut r = base();
        r.per = 999.0;
        r.per_max = 0.0; // 비활성
        let d = evaluate(&r);
        assert_eq!(d.action, Action::Hold);
    }

    #[test]
    fn per_disabled_when_per_zero() {
        let mut r = base();
        r.per = 0.0; // 데이터 없음
        r.per_max = 30.0;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::Hold);
    }

    #[test]
    fn pbr_overvalued_blocks_buy() {
        let mut r = base();
        r.pbr = 6.0;
        r.pbr_max = 3.0;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::BlockBuy);
        assert!(d.triggered.contains(&"pbr_overvalued".to_string()));
    }

    #[test]
    fn debt_ratio_excess_blocks_buy() {
        let mut r = base();
        r.debt_ratio = 350.0;
        r.debt_ratio_max = 200.0;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::BlockBuy);
        assert!(d.triggered.contains(&"debt_ratio_excess".to_string()));
    }

    #[test]
    fn debt_ratio_within_limit_no_action() {
        let mut r = base();
        r.debt_ratio = 150.0;
        r.debt_ratio_max = 200.0;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::Hold);
    }

    #[test]
    fn roe_weak_reduces_position() {
        let mut r = base();
        r.roe = -5.0; // 적자
        r.roe_min = 5.0;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::ReducePosition);
        assert!(d.triggered.contains(&"roe_weak".to_string()));
    }

    #[test]
    fn roe_min_zero_disabled() {
        let mut r = base();
        r.roe = -99.0;
        r.roe_min = 0.0; // 비활성
        let d = evaluate(&r);
        assert_eq!(d.action, Action::Hold);
    }

    #[test]
    fn rsi_overbought_reduces_position() {
        let mut r = base();
        r.rsi = 82.0;
        r.rsi_overbought = 75.0;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::ReducePosition);
        assert!(d.triggered.contains(&"rsi_overbought".to_string()));
    }

    #[test]
    fn rsi_overbought_disabled_when_zero() {
        let mut r = base();
        r.rsi = 99.0;
        r.rsi_overbought = 0.0;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::Hold);
    }

    #[test]
    fn ma_death_cross_blocks_buy() {
        let mut r = base();
        r.ma_death_cross = true;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::BlockBuy);
        assert!(d.triggered.contains(&"ma_death_cross".to_string()));
    }

    #[test]
    fn volume_collapse_blocks_buy() {
        let mut r = base();
        r.volume_collapse = true;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::BlockBuy);
        assert!(d.triggered.contains(&"volume_collapse".to_string()));
    }

    #[test]
    fn stop_loss_overrides_fundamental() {
        let mut r = base();
        r.current_price = 68000.0; // stop-loss 발동
        r.per = 100.0;
        r.per_max = 30.0;
        r.ma_death_cross = true;
        let d = evaluate(&r);
        assert_eq!(d.action, Action::ForceSell); // 손절이 우선
    }
}
