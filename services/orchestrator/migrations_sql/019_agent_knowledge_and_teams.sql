-- Migration 019: Agent Knowledge Sources and Team Associations

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_agents (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    role VARCHAR(100) DEFAULT 'member',
    PRIMARY KEY (team_id, agent_id)
);

CREATE TABLE IF NOT EXISTS commander_agents (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    routing_rules JSONB,
    PRIMARY KEY (team_id, agent_id)
);

CREATE TABLE IF NOT EXISTS agent_tools (
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_id, tool_id)
);

CREATE TABLE IF NOT EXISTS agent_knowledge_sources (
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    source_id UUID REFERENCES knowledge_sources(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (agent_id, source_id)
);

ALTER TABLE agents ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS temperature NUMERIC DEFAULT 0.3;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS stt_provider VARCHAR(100) DEFAULT 'elevenlabs_scribe';
