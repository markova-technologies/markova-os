import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  Globe,
  Users,
  Phone,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles
} from 'lucide-react'

const OnboardingModal = ({ onComplete }) => {
  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState({
    companyName: '',
    industry: '',
    companySize: '',
    website: '',
    country: '',
    primaryPhone: '',
    useCase: '',
    agentLanguage: 'English'
  })

  const steps = [
    {
      title: 'Welcome to MARKOVA',
      subtitle: 'Let\'s set up your AI-powered call center in a few quick steps.',
      icon: Sparkles
    },
    {
      title: 'Company Information',
      subtitle: 'Tell us about your organization.',
      icon: Building2
    },
    {
      title: 'Contact & Location',
      subtitle: 'Where is your business based?',
      icon: Globe
    },
    {
      title: 'Use Case',
      subtitle: 'How do you plan to use MARKOVA Voice?',
      icon: Phone
    }
  ]

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleNext = () => {
    if (step < steps.length - 1) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 0) setStep(step - 1)
  }

  const handleFinish = () => {
    // Save onboarding data to localStorage (in real app, send to backend)
    localStorage.setItem('companyProfile', JSON.stringify(formData))
    onComplete()
  }

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem', boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)'
            }}>
              <Sparkles size={36} color="white" />
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
              Welcome to MARKOVA 🚀
            </h2>
            <p style={{ color: 'var(--gray)', fontSize: '1rem', lineHeight: 1.6, maxWidth: '400px', margin: '0 auto' }}>
              We just need a few details about your company to get your AI call center up and running.
            </p>
          </div>
        )
      case 1:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="onboarding-field">
              <label>Company Name</label>
              <input
                type="text" placeholder="e.g. Acme Corp"
                value={formData.companyName}
                onChange={e => handleChange('companyName', e.target.value)}
              />
            </div>
            <div className="onboarding-field">
              <label>Industry</label>
              <select value={formData.industry} onChange={e => handleChange('industry', e.target.value)}>
                <option value="">Select industry</option>
                <option value="healthcare">Healthcare</option>
                <option value="finance">Finance & Banking</option>
                <option value="ecommerce">E-commerce & Retail</option>
                <option value="saas">SaaS / Technology</option>
                <option value="education">Education</option>
                <option value="logistics">Logistics & Transport</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="onboarding-field">
              <label>Company Size</label>
              <select value={formData.companySize} onChange={e => handleChange('companySize', e.target.value)}>
                <option value="">Select size</option>
                <option value="1-10">1–10 employees</option>
                <option value="11-50">11–50 employees</option>
                <option value="51-200">51–200 employees</option>
                <option value="201-1000">201–1,000 employees</option>
                <option value="1000+">1,000+ employees</option>
              </select>
            </div>
          </div>
        )
      case 2:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="onboarding-field">
              <label>Website</label>
              <input
                type="url" placeholder="https://yourcompany.com"
                value={formData.website}
                onChange={e => handleChange('website', e.target.value)}
              />
            </div>
            <div className="onboarding-field">
              <label>Country</label>
              <input
                type="text" placeholder="e.g. Ethiopia"
                value={formData.country}
                onChange={e => handleChange('country', e.target.value)}
              />
            </div>
            <div className="onboarding-field">
              <label>Primary Phone Number</label>
              <input
                type="tel" placeholder="+251..."
                value={formData.primaryPhone}
                onChange={e => handleChange('primaryPhone', e.target.value)}
              />
            </div>
          </div>
        )
      case 3:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="onboarding-field">
              <label>Primary Use Case</label>
              <select value={formData.useCase} onChange={e => handleChange('useCase', e.target.value)}>
                <option value="">Select use case</option>
                <option value="inbound">Inbound Customer Support</option>
                <option value="outbound">Outbound Sales Calls</option>
                <option value="appointment">Appointment Scheduling</option>
                <option value="survey">Customer Surveys</option>
                <option value="reminder">Payment Reminders</option>
                <option value="mixed">Mixed / All of the above</option>
              </select>
            </div>
            <div className="onboarding-field">
              <label>Agent Language</label>
              <select value={formData.agentLanguage} onChange={e => handleChange('agentLanguage', e.target.value)}>
                <option value="English">English</option>
                <option value="Amharic">Amharic</option>
                <option value="Swahili">Swahili</option>
                <option value="French">French</option>
                <option value="Arabic">Arabic</option>
              </select>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="onboarding-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          style={{
            background: 'var(--bg-card)', borderRadius: '1.25rem',
            border: '1px solid var(--border-main)',
            width: '100%', maxWidth: '520px', padding: '2rem',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4)'
          }}
        >
          {/* Progress bar */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '2rem' }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: '4px', borderRadius: '4px',
                background: i <= step ? 'linear-gradient(90deg, #10b981, #059669)' : 'var(--border-main)',
                transition: 'all 0.3s ease'
              }} />
            ))}
          </div>

          {/* Step header */}
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
            {steps[step].title}
          </h3>
          <p style={{ color: 'var(--gray)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            {steps[step].subtitle}
          </p>

          {/* Step content */}
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {renderStepContent()}
          </motion.div>

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', gap: '1rem' }}>
            {step > 0 ? (
              <button onClick={handleBack} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.25rem', borderRadius: '0.75rem',
                background: 'var(--bg-main)', border: '1px solid var(--border-main)',
                color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500
              }}>
                <ArrowLeft size={16} /> Back
              </button>
            ) : <div />}

            {step < steps.length - 1 ? (
              <button onClick={handleNext} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.5rem', borderRadius: '0.75rem',
                background: 'linear-gradient(90deg, #10b981, #059669)',
                border: 'none', color: 'white', cursor: 'pointer',
                fontSize: '0.9rem', fontWeight: 600,
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}>
                {step === 0 ? "Let's Go" : 'Next'} <ArrowRight size={16} />
              </button>
            ) : (
              <button onClick={handleFinish} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.5rem', borderRadius: '0.75rem',
                background: 'linear-gradient(90deg, #10b981, #059669)',
                border: 'none', color: 'white', cursor: 'pointer',
                fontSize: '0.9rem', fontWeight: 600,
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}>
                <Check size={16} /> Finish Setup
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default OnboardingModal
