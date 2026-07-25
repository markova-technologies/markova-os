const PLANS = {
  starter: {
    monthlyPriceUsd: 49,
    maxAgents: 3,
    maxVoiceMinutes: 500,
    features: ['basic_rag', 'email_support']
  },
  professional: {
    monthlyPriceUsd: 199,
    maxAgents: 15,
    maxVoiceMinutes: 2000,
    features: ['basic_rag', 'advanced_analytics', 'priority_support', 'api_access']
  },
  enterprise: {
    monthlyPriceUsd: 999,
    maxAgents: 0, // unlimited
    maxVoiceMinutes: 0, // unlimited
    features: ['basic_rag', 'advanced_analytics', 'priority_support', 'api_access', 'custom_models', 'sso', 'sla']
  }
};

class PlanManager {
  static getPlanDetails(planId) {
    return PLANS[planId] || PLANS['starter'];
  }

  static hasFeature(planId, feature) {
    const plan = this.getPlanDetails(planId);
    return plan.features.includes(feature);
  }
}

module.exports = { PLANS, PlanManager };
