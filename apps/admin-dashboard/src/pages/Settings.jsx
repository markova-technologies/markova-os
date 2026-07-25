import React, { useState } from 'react';
import {
    IoSettings,
    IoNotifications,
    IoColorPalette,
    IoShieldCheckmark,
    IoLink,
    IoLanguage,
    IoSave,
    IoSync
} from 'react-icons/io5';
import Header from '../components/layout/Header';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';

const Settings = ({ onMenuClick }) => {
    const { theme, toggleTheme } = useTheme();
    const { notificationsEnabled, toggleNotifications, loading } = useData();
    const [activeTab, setActiveTab] = useState('general');

    const tabs = [
        { id: 'general', label: 'General', icon: IoSettings },
        { id: 'notifications', label: 'Notifications', icon: IoNotifications },
        { id: 'appearance', label: 'Appearance', icon: IoColorPalette },
        { id: 'security', label: 'Security', icon: IoShieldCheckmark },
        { id: 'integrations', label: 'Integrations', icon: IoLink },
    ];

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 font-medium">Loading settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
            <Header title="System Settings" breadcrumbs={['Dashboard', 'Settings']} onMenuClick={onMenuClick} />

            <main className="p-6">
                <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
                    {/* Settings Navigation */}
                    <div className="w-full lg:w-64 space-y-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                  ${activeTab === tab.id
                                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                `}
                            >
                                <tab.icon className="w-5 h-5" />
                                <span className="font-semibold">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Settings Content */}
                    <div className="flex-1">
                        <Card className="min-h-[600px] flex flex-col">
                            {activeTab === 'notifications' && (
                                <div className="space-y-8 animate-fade-in">
                                    <h3 className="text-xl font-bold mb-6">Notification Preferences</h3>

                                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-lg">
                                                <IoNotifications className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">System Alarms</h4>
                                                <p className="text-sm text-gray-500">Enable warning banners for system issues.</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={notificationsEnabled}
                                                onChange={toggleNotifications}
                                            />
                                            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-primary-500"></div>
                                        </label>
                                    </div>

                                    <div className="space-y-4 opacity-50 pointer-events-none">
                                        <h4 className="font-bold text-sm uppercase text-gray-400 tracking-wider">Coming Soon</h4>
                                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">Email Reports</h4>
                                                <p className="text-sm text-gray-500">Receive daily performance summaries via email.</p>
                                            </div>
                                            <div className="w-14 h-7 bg-gray-200 rounded-full dark:bg-gray-700"></div>
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">Slack Integration</h4>
                                                <p className="text-sm text-gray-500">Forward critical alerts to Slack channels.</p>
                                            </div>
                                            <div className="w-14 h-7 bg-gray-200 rounded-full dark:bg-gray-700"></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'general' && (
                                <div className="space-y-8 animate-fade-in">
                                    <div>
                                        <h3 className="text-xl font-bold mb-6">General Preferences</h3>
                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">System Name</label>
                                                <input type="text" className="input-field" defaultValue="AI Assistant Dashboard" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">System Language</label>
                                                <div className="relative">
                                                    <IoLanguage className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                    <select className="input-field pl-10">
                                                        <option>English (United States)</option>
                                                        <option>Spanish (ES-ES)</option>
                                                        <option>French (FR-FR)</option>
                                                        <option>German (DE-DE)</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data Refresh Rate</label>
                                                <div className="relative">
                                                    <IoSync className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                    <select className="input-field pl-10">
                                                        <option>Real-time (WebSocket)</option>
                                                        <option>Every 30 seconds</option>
                                                        <option>Every 1 minute</option>
                                                        <option>Every 5 minutes</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-8 border-t border-gray-100 dark:border-gray-700">
                                        <h3 className="text-xl font-bold mb-6">Profile Settings</h3>
                                        <div className="flex items-center gap-6">
                                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-emerald-600 flex items-center justify-center text-white text-3xl font-bold shadow-xl">
                                                AI
                                            </div>
                                            <div className="flex-1 space-y-4">
                                                <Button variant="secondary" size="sm">Change Avatar</Button>
                                                <p className="text-xs text-gray-500">Avatar used for the system profile in the sidebar.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'appearance' && (
                                <div className="space-y-8 animate-fade-in">
                                    <h4 className="text-xl font-bold mb-6">Appearance Customization</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <button
                                            onClick={() => theme !== 'light' && toggleTheme()}
                                            className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${theme === 'light' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-lg shadow-primary-500/10' : 'border-gray-200 dark:border-gray-700'}`}
                                        >
                                            <div className="w-16 h-16 rounded-full bg-white border border-gray-200" />
                                            <span className="font-bold">Light Mode</span>
                                            <p className="text-xs text-gray-500 text-center">Classic clean view, better for brightly lit environments.</p>
                                        </button>
                                        <button
                                            onClick={() => theme !== 'dark' && toggleTheme()}
                                            className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${theme === 'dark' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-lg shadow-primary-500/10' : 'border-gray-200 dark:border-gray-700'}`}
                                        >
                                            <div className="w-16 h-16 rounded-full bg-gray-900 border border-gray-700" />
                                            <span className="font-bold">Dark Mode</span>
                                            <p className="text-xs text-gray-500 text-center">Easier on the eyes in dark rooms, saves battery.</p>
                                        </button>
                                    </div>

                                    <div className="pt-8 border-t border-gray-100 dark:border-gray-700">
                                        <h3 className="text-lg font-bold mb-4">Glassmorphism Intensity</h3>
                                        <input type="range" className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500" />
                                        <div className="flex justify-between text-xs text-gray-400 mt-2">
                                            <span>Low</span>
                                            <span>Medium</span>
                                            <span>High</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab !== 'general' && activeTab !== 'appearance' && (
                                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                                    <IoSave className="w-16 h-16 text-gray-400 mb-4" />
                                    <h3 className="text-xl font-bold">Content Coming Soon</h3>
                                    <p className="text-sm mt-2">The {activeTab} settings are currently under development.</p>
                                </div>
                            )}

                            <div className="mt-auto pt-8 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                                <Button variant="ghost">Discard Changes</Button>
                                <Button variant="primary" icon={<IoSave />}>Save Settings</Button>
                            </div>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Settings;
