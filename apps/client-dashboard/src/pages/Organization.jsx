import React, { useState, useEffect } from 'react'
import { Building2, Users, Network, Plus, FolderTree } from 'lucide-react'
import api, { getOrgProfile } from '../api/client'
import './Organization.css'

const Organization = () => {
  const [departments, setDepartments] = useState([
    {
      id: 'd-1',
      name: 'Global Operations',
      parent_id: null,
      children: [
        {
          id: 'd-2',
          name: 'Customer Support (Tier 1)',
          parent_id: 'd-1',
          children: []
        },
        {
          id: 'd-3',
          name: 'Technical Support (Tier 2)',
          parent_id: 'd-1',
          children: []
        }
      ]
    }
  ])

  useEffect(() => {
    getOrgProfile().then(({ data }) => {
      if (data && data.company_name) {
        setDepartments(prev => {
          const newDepts = [...prev]
          if (newDepts.length > 0) {
            newDepts[0].name = data.company_name
          }
          return newDepts
        })
      }
    }).catch(console.error)
  }, [])

  const renderTree = (nodes) => {
    return (
      <ul className="org-tree">
        {nodes.map(node => (
          <li key={node.id} className="org-node">
            <div className="node-content">
              <FolderTree className="node-icon" size={18} />
              <span className="node-name">{node.name}</span>
              <button className="btn-add-child"><Plus size={14} /></button>
            </div>
            {node.children && node.children.length > 0 && renderTree(node.children)}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="org-page">
      <header className="page-header">
        <h1>Organization & Departments</h1>
        <p>Manage your company hierarchy, teams, and data isolation.</p>
      </header>

      <div className="org-dashboard">
        <div className="org-sidebar">
          <div className="sidebar-section">
            <h3><Building2 size={18} /> Departments</h3>
            <button className="btn-new-dept">
              <Plus size={16} /> New Root Department
            </button>
            <div className="tree-container">
              {renderTree(departments)}
            </div>
          </div>
        </div>
        
        <div className="org-main">
          <div className="empty-state">
            <Network size={48} className="text-gray-600 mb-4" />
            <h2>Select a Department</h2>
            <p>Click on a department from the tree to manage its settings, assigned users, and AI agents.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Organization
