import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useToast } from '../contexts/ToastContext'
import {
  Building2,
  Briefcase,
  Users,
  Key,
  Bot,
  Phone,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Loader2,
  Database
} from 'lucide-react'
import { ROUTES } from '../config/site'
import './OnboardingCenter.css'

const OnboardingCenter = () => {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    companyName: '',
    industry: '',
    template: '',
    providerKeys: { twilio: '', google_sheets: '', google_drive: '' },
    websiteUrl: '',
    companyKnowledge: '',
    firstAgentName: '',
    firstAgentPrompt: '',
    phoneNumber: ''
  })

  const steps = [
    { title: 'Welcome & Company Info', icon: Building2 },
    { title: 'Industry Selection', icon: Briefcase },
    { title: 'Workforce Template', icon: Users },
    { title: 'Knowledge Base', icon: Database },
    { title: 'AI Workforce', icon: Bot },
    { title: 'First Phone Number', icon: Phone }
  ]

  const templates = {
    healthcare: [{ id: 'reception', name: 'Receptionist' }, { id: 'appointments', name: 'Appointment Scheduler' }, { id: 'triage', name: 'Symptom Triage' }],
    real_estate: [{ id: 'lead_gen', name: 'Lead Qualifier' }, { id: 'booking', name: 'Viewing Scheduler' }, { id: 'inquiry', name: 'Property Inquiry' }],
    education: [{ id: 'admissions', name: 'Admissions Assistant' }, { id: 'support', name: 'IT Support' }, { id: 'enrollment', name: 'Enrollment Guide' }],
    hospitality: [{ id: 'reservations', name: 'Reservation Agent' }, { id: 'concierge', name: 'Concierge' }, { id: 'room_service', name: 'Room Service' }],
    ecommerce: [{ id: 'support', name: 'Order Support' }, { id: 'sales', name: 'Sales Assistant' }, { id: 'returns', name: 'Returns Processing' }],
    finance: [{ id: 'collections', name: 'Collections Agent' }, { id: 'support', name: 'Customer Support' }, { id: 'loans', name: 'Loan Inquiry' }],
    automotive: [{ id: 'service', name: 'Service Scheduler' }, { id: 'sales', name: 'Sales Agent' }, { id: 'parts', name: 'Parts Inquiry' }],
    legal: [{ id: 'intake', name: 'Case Intake' }, { id: 'consultation', name: 'Consultation Booking' }, { id: 'billing', name: 'Billing Support' }],
    home_services: [{ id: 'dispatch', name: 'Dispatch' }, { id: 'quotes', name: 'Quotes' }, { id: 'support', name: 'Customer Support' }],
    technology: [{ id: 'tech_support', name: 'L1 Tech Support' }, { id: 'billing', name: 'Billing Support' }, { id: 'success', name: 'Customer Success' }],
    general: [{ id: 'general_support', name: 'General Support' }, { id: 'general_sales', name: 'General Sales' }, { id: 'general_admin', name: 'Admin Assistant' }]
  }

  // Common industries for the datalist
  const predefinedIndustries = [
    'Healthcare', 'Real Estate', 'Education', 'Hospitality', 'E-commerce', 
    'Finance', 'Automotive', 'Legal', 'Home Services', 'Technology'
  ];

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleKeyChange = (provider, value) => {
    setFormData(prev => ({ ...prev, providerKeys: { ...prev.providerKeys, [provider]: value } }))
  }

  const handleNext = async () => {
    setLoading(true)
    try {
      // API Calls per step
      if (step === 0 && formData.companyName) {
        await api.put('/tenant/company', { name: formData.companyName }).catch(() => {});
      }
      if (step === 3) {
        await api.post('/tenant/providers', formData.providerKeys).catch(() => {});
      }
      if (step === 4 && formData.firstAgentName) {
        await api.post('/agents', {
          name: formData.firstAgentName,
          prompt: formData.firstAgentPrompt || 'You are a helpful assistant.'
        }).catch(() => {});
      }
      
      if (step < steps.length - 1) setStep(step + 1)
    } catch (err) {
      showError('An error occurred while saving your data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1)
    }
  }

  const handleFinish = async () => {
    setLoading(true)
    try {
      if (formData.phoneNumber) {
        await api.post('/numbers', {
          phone_number: formData.phoneNumber,
          provider: 'twilio'
        }).catch(() => {});
      }

      localStorage.setItem('onboardingComplete', 'true')
      localStorage.setItem('companyProfile', JSON.stringify(formData))
      success('Onboarding completed successfully!', 'Welcome aboard')
      navigate(ROUTES.app)
    } catch (err) {
      showError('An error occurred during finalization. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="ob-step-content">
            <h2>Welcome to MARKOVA 🚀</h2>
            <p>Let's set up your AI-powered call center. What is your company name?</p>
            <div className="ob-field">
              <label>Company Name</label>
              <input type="text" placeholder="e.g. Acme Corp" value={formData.companyName} onChange={e => handleChange('companyName', e.target.value)} />
            </div>
          </div>
        )
      case 1:
        return (
          <div className="ob-step-content">
            <h2>Select Your Industry</h2>
            <p>Choose from the common options below, or select "Other" to type your own. We will tailor your AI workforce accordingly.</p>
            <div className="ob-field" style={{ marginBottom: '1rem' }}>
              <label>Industry</label>
              <select 
                value={predefinedIndustries.includes(formData.industry) ? formData.industry : (formData.industry ? 'Other' : '')} 
                onChange={e => {
                  if (e.target.value !== 'Other') {
                    handleChange('industry', e.target.value);
                  } else {
                    handleChange('industry', ' '); // Use a space to trigger "Other" input
                  }
                }}
                style={{ fontSize: '1.05rem', padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-main)', color: 'white', border: '1px solid var(--border-main)' }}
              >
                <option value="" disabled>-- Select an Industry --</option>
                {predefinedIndustries.map(ind => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
                <option value="Other">Other (Type custom industry)</option>
              </select>
            </div>
            
            {(!predefinedIndustries.includes(formData.industry) && formData.industry !== '') || formData.industry === ' ' ? (
              <div className="ob-field" style={{ marginBottom: '2rem' }}>
                <label>Custom Industry</label>
                <input 
                  type="text"
                  placeholder="e.g. Space Exploration, Plumbing..." 
                  value={predefinedIndustries.includes(formData.industry) || formData.industry === ' ' ? '' : formData.industry} 
                  onChange={e => handleChange('industry', e.target.value)}
                  style={{ fontSize: '1.05rem', padding: '0.75rem' }}
                  autoFocus
                />
              </div>
            ) : null}
          </div>
        )
      case 2:
        return (
          <div className="ob-step-content">
            <h2>Choose a Workforce Template</h2>
            <p>Start with pre-built agents tailored for your business.</p>
            {(() => {
              const indKey = (formData.industry || '').toLowerCase().replace(/[\s-]/g, '_');
              const availableTemplates = templates[indKey] || templates.general;
              
              return (
                <div className="ob-grid">
                  {availableTemplates.map(tpl => (
                    <div 
                      key={tpl.id} 
                      className={`ob-card ${formData.template === tpl.id ? 'selected' : ''}`}
                      onClick={() => handleChange('template', tpl.id)}
                    >
                      {tpl.name}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )
      case 3:
        return (
          <div className="ob-step-content">
            <h2>Knowledge Base & Integrations</h2>
            <p>Provide information about your business so your agents know how to answer questions.</p>
            
            <div className="ob-field">
              <label>Website URL (We will scrape this for context)</label>
              <input type="url" placeholder="https://www.yourcompany.com" value={formData.websiteUrl} onChange={e => handleChange('websiteUrl', e.target.value)} />
            </div>

            <div className="ob-field">
              <label>Company Rules / FAQs</label>
              <textarea placeholder="Paste your FAQs, business rules, or core information here..." rows={4} value={formData.companyKnowledge} onChange={e => handleChange('companyKnowledge', e.target.value)} />
            </div>

            <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-main)', paddingTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-main)' }}>Optional Integrations</h3>
              <div className="ob-field">
                <label><Phone size={16} style={{display: 'inline', marginRight: '5px', verticalAlign: 'middle'}}/> Twilio Account SID</label>
                <input type="text" placeholder="AC..." value={formData.providerKeys.twilio} onChange={e => handleKeyChange('twilio', e.target.value)} />
              </div>
              <div className="ob-field">
                <label><Database size={16} style={{display: 'inline', marginRight: '5px', verticalAlign: 'middle'}}/> Google Sheets API Key</label>
                <input type="password" placeholder="AIzaSy..." value={formData.providerKeys.google_sheets} onChange={e => handleKeyChange('google_sheets', e.target.value)} />
              </div>
            </div>
          </div>
        )
      case 4:
        return (
          <div className="ob-step-content">
            <h2>Meet Your New AI Workforce</h2>
            <p style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Your platform comes with a built-in <strong>Commander Agent</strong>. This agent acts as the global router—it answers incoming calls, greets the customer, and seamlessly routes them to the right specialized agent. 
              <br/><br/>
              Let's configure the first <strong>Specialized Agent</strong> that your Commander will route calls to.
            </p>
            <div className="ob-field">
              <label>Specialized Agent Name</label>
              <input type="text" placeholder="e.g. Sarah (Support Specialist)" value={formData.firstAgentName} onChange={e => handleChange('firstAgentName', e.target.value)} />
            </div>
            <div className="ob-field">
              <label>Specialized Agent Role & Tone</label>
              <textarea placeholder="e.g. You are a helpful support specialist for Acme Corp. Always be polite and try to resolve issues quickly..." rows={4} value={formData.firstAgentPrompt} onChange={e => handleChange('firstAgentPrompt', e.target.value)} />
            </div>
          </div>
        )
      case 5:
        return (
          <div className="ob-step-content">
            <h2>First Phone Number</h2>
            <p>Assign a phone number to your first agent.</p>
            <div className="ob-field">
              <label>Phone Number</label>
              <input type="text" placeholder="+1234567890" value={formData.phoneNumber} onChange={e => handleChange('phoneNumber', e.target.value)} />
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-container">
        {/* Progress Sidebar */}
        <div className="onboarding-sidebar">
          {steps.map((s, i) => {
            const Icon = s.icon
            return (
              <div key={i} className={`ob-step ${i === step ? 'active' : i < step ? 'completed' : ''}`}>
                <div className="ob-step-icon"><Icon size={18} /></div>
                <span>{s.title}</span>
              </div>
            )
          })}
        </div>

        {/* Main Content */}
        <div className="onboarding-main">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="ob-content-wrapper"
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="onboarding-footer">
            {step > 0 ? (
              <button className="btn-secondary" onClick={handleBack} disabled={loading}><ArrowLeft size={16} /> Back</button>
            ) : <div />}
            
            {step < steps.length - 1 ? (
              <button className="btn-primary" onClick={handleNext} disabled={loading}>
                {loading ? <Loader2 className="spinner" size={16} /> : 'Next'} <ArrowRight size={16} />
              </button>
            ) : (
              <button className="btn-primary" onClick={handleFinish} disabled={loading}>
                {loading ? <Loader2 className="spinner" size={16} /> : <Check size={16} />} Finish Setup
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default OnboardingCenter

