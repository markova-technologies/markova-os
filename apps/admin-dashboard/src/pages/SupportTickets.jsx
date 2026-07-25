import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, MessageSquare, Clock, User, AlertCircle, CheckCircle2, ChevronRight, X, Send, Building2 } from 'lucide-react';

export default function SupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      // Mocking /api/admin/tickets endpoint
      const res = await axios.get('http://localhost:8000/api/admin/tickets').catch(() => ({
        data: {
          tickets: [
            { id: 'TKT-1042', subject: 'API Rate Limits Exceeded', tenant: 'Acme Corp', status: 'open', priority: 'high', created: '2 hours ago', unread: true,
              messages: [
                { sender: 'client', name: 'John Doe', time: '2 hours ago', content: 'We are hitting 429 Too Many Requests on the orchestration endpoint but our dashboard shows we are well within our tier limits. Can you investigate?' },
              ]
            },
            { id: 'TKT-1041', subject: 'Amharic Voice Latency', tenant: 'Global Logistics', status: 'in-progress', priority: 'medium', created: '5 hours ago', unread: false,
              messages: [
                { sender: 'client', name: 'Alice Smith', time: '5 hours ago', content: 'The Amharic voice engine is taking ~3s to respond. It was much faster yesterday.' },
                { sender: 'support', name: 'Admin User', time: '4 hours ago', content: 'We noticed a spike in ElevenLabs API latency. We are actively monitoring and routing traffic to fallback engines where possible.' }
              ]
            },
            { id: 'TKT-1040', subject: 'Billing Update Issue', tenant: 'MedHealth Clinics', status: 'resolved', priority: 'low', created: '1 day ago', unread: false,
              messages: [
                { sender: 'client', name: 'Finance Team', time: '1 day ago', content: 'We need to update our credit card but the portal throws a 500 error.' },
                { sender: 'support', name: 'Admin User', time: '22 hours ago', content: 'There was a temporary issue with our Stripe webhook. It has been resolved. Please try again.' },
                { sender: 'client', name: 'Finance Team', time: '20 hours ago', content: 'Working now, thanks!' }
              ]
            },
            { id: 'TKT-1039', subject: 'Custom Integration Request', tenant: 'EduTech Online', status: 'open', priority: 'medium', created: '2 days ago', unread: true,
              messages: [
                { sender: 'client', name: 'Tech Lead', time: '2 days ago', content: 'We want to integrate our proprietary CRM via webhooks. Do you have documentation on the expected payload format?' }
              ]
            }
          ]
        }
      }));
      setTickets(res.data.tickets || []);
    } catch (error) {
      console.error('Failed to fetch support tickets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.subject.toLowerCase().includes(searchTerm.toLowerCase()) || t.tenant.toLowerCase().includes(searchTerm.toLowerCase()) || t.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'medium': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      default: return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'open': return 'text-emerald-400';
      case 'in-progress': return 'text-amber-400';
      case 'resolved': return 'text-gray-500';
      default: return 'text-gray-400';
    }
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedTicket) return;
    
    // Optimistic update
    const newMsg = { sender: 'support', name: 'Admin User', time: 'Just now', content: replyText };
    const updatedTickets = tickets.map(t => {
      if (t.id === selectedTicket.id) {
        return { ...t, status: t.status === 'open' ? 'in-progress' : t.status, unread: false, messages: [...t.messages, newMsg] };
      }
      return t;
    });
    
    setTickets(updatedTickets);
    setSelectedTicket({ ...selectedTicket, messages: [...selectedTicket.messages, newMsg] });
    setReplyText('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-emerald-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mr-3"></div>
        Loading support tickets...
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 text-gray-100 flex flex-col h-[calc(100vh-64px)] overflow-hidden"
    >
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Support Tickets</h1>
          <p className="text-gray-400 text-sm">Manage incoming tenant requests and platform issues</p>
        </div>
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Ticket List */}
        <div className={`bg-gray-800 rounded-xl border border-gray-700 flex flex-col ${selectedTicket ? 'w-1/3 hidden lg:flex' : 'w-full'}`}>
          <div className="p-4 border-b border-gray-700 flex flex-col gap-3 flex-shrink-0">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search tickets..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg pl-9 pr-4 py-2 w-full focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setFilterStatus('all')} className={`px-3 py-1 rounded-full text-xs font-medium border ${filterStatus === 'all' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-700'}`}>All</button>
              <button onClick={() => setFilterStatus('open')} className={`px-3 py-1 rounded-full text-xs font-medium border ${filterStatus === 'open' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-700'}`}>Open</button>
              <button onClick={() => setFilterStatus('in-progress')} className={`px-3 py-1 rounded-full text-xs font-medium border ${filterStatus === 'in-progress' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-700'}`}>In Progress</button>
              <button onClick={() => setFilterStatus('resolved')} className={`px-3 py-1 rounded-full text-xs font-medium border ${filterStatus === 'resolved' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-700'}`}>Resolved</button>
            </div>
          </div>
          
          <div className="overflow-y-auto flex-1 p-2">
            {filteredTickets.map(ticket => (
              <div 
                key={ticket.id} 
                onClick={() => setSelectedTicket(ticket)}
                className={`p-4 mb-2 rounded-lg cursor-pointer transition-all border ${selectedTicket?.id === ticket.id ? 'bg-gray-700/50 border-gray-500' : 'bg-gray-900/30 border-gray-800 hover:bg-gray-800 hover:border-gray-700'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    {ticket.unread && <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></div>}
                    <span className="text-xs font-mono text-gray-500">{ticket.id}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getPriorityColor(ticket.priority)} uppercase`}>
                    {ticket.priority}
                  </span>
                </div>
                <h4 className={`font-medium text-sm mb-1 line-clamp-1 ${ticket.unread ? 'text-white' : 'text-gray-300'}`}>{ticket.subject}</h4>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{ticket.tenant}</span>
                  <span className="flex items-center"><Clock size={12} className="mr-1"/>{ticket.created}</span>
                </div>
              </div>
            ))}
            {filteredTickets.length === 0 && (
              <div className="p-8 text-center text-gray-500 text-sm">
                No tickets found.
              </div>
            )}
          </div>
        </div>

        {/* Ticket Detail */}
        <div className={`bg-gray-800 rounded-xl border border-gray-700 flex-1 flex flex-col ${!selectedTicket ? 'hidden lg:flex lg:items-center lg:justify-center' : 'flex'}`}>
          {!selectedTicket ? (
            <div className="text-center text-gray-500 flex flex-col items-center">
              <MessageSquare size={48} className="mb-4 text-gray-600" opacity={0.5} />
              <p>Select a ticket from the list to view details</p>
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div className="p-6 border-b border-gray-700 flex-shrink-0 relative">
                <button onClick={() => setSelectedTicket(null)} className="lg:hidden absolute top-4 right-4 p-2 bg-gray-700 rounded text-gray-300">
                  <X size={16} />
                </button>
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2 py-1 bg-gray-900 rounded border border-gray-700 text-xs font-mono text-gray-400">{selectedTicket.id}</span>
                  <span className={`flex items-center text-xs font-medium uppercase ${getStatusColor(selectedTicket.status)}`}>
                    {selectedTicket.status === 'resolved' ? <CheckCircle2 size={14} className="mr-1"/> : <AlertCircle size={14} className="mr-1"/>}
                    {selectedTicket.status}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">{selectedTicket.subject}</h2>
                <div className="flex items-center text-sm text-gray-400 gap-4">
                  <span className="flex items-center"><Building2 size={14} className="mr-1"/> {selectedTicket.tenant}</span>
                  <span className="flex items-center"><Clock size={14} className="mr-1"/> Opened {selectedTicket.created}</span>
                </div>
              </div>

              {/* Message Thread */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {selectedTicket.messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.sender === 'support' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl p-4 ${msg.sender === 'support' ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-50 rounded-tr-sm' : 'bg-gray-700 border border-gray-600 text-gray-200 rounded-tl-sm'}`}>
                      <div className="flex justify-between items-center mb-2 text-xs">
                        <span className={`font-semibold ${msg.sender === 'support' ? 'text-emerald-400' : 'text-gray-300'}`}>{msg.name}</span>
                        <span className="text-gray-400 ml-4">{msg.time}</span>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply Box */}
              <div className="p-4 border-t border-gray-700 bg-gray-900/50 flex-shrink-0">
                {selectedTicket.status === 'resolved' ? (
                  <div className="text-center p-4 text-gray-500 text-sm bg-gray-800 rounded-lg border border-gray-700">
                    This ticket has been marked as resolved. Replies are disabled.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <textarea 
                      placeholder="Type your reply to the tenant..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg p-3 min-h-[100px] focus:outline-none focus:border-emerald-500 resize-none transition-colors"
                    ></textarea>
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-500">Replies will be sent to the tenant's primary email.</div>
                      <div className="flex gap-2">
                        <button className="px-4 py-2 bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 text-sm font-medium rounded-lg transition-colors">
                          Close Ticket
                        </button>
                        <button onClick={handleSendReply} disabled={!replyText.trim()} className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium rounded-lg flex items-center transition-colors">
                          <Send size={16} className="mr-2" /> Send Reply
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}