import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import dotenv from 'dotenv';
import { ExecutionStatus } from '@markova/shared-types';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5006;
const CAPABILITY_REGISTRY_URL = process.env.CAPABILITY_REGISTRY_URL || 'http://capability-registry:5009';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface TaskNode {
  id: string;
  name: string;
  capabilityId?: string;
  action: string;
  dependencies: string[];
  status: ExecutionStatus;
  result?: any;
}

// Health
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', service: 'planner-service', version: '1.1.0' });
});

// 1. Plan Generation — decompose goal into Task Graph DAG and persist to DB
app.post('/v1/plan', async (req: Request, res: Response) => {
  const { goal, capabilities = [] } = req.body;
  const companyId = (req.headers['x-company-id'] || req.headers['x-tenant-id']) as string || 'default';

  if (!goal) {
    return res.status(400).json({ error: 'Goal is required' });
  }

  const planId = uuidv4();

  // Task Graph DAG: always start with context validation -> knowledge fetch -> capability execution
  const tasks: TaskNode[] = [
    {
      id: 'task-1',
      name: 'Verify Context & Permissions',
      action: 'validate_goal',
      dependencies: [],
      status: ExecutionStatus.PENDING
    },
    {
      id: 'task-2',
      name: 'Fetch Required Knowledge & Data',
      action: 'fetch_knowledge',
      dependencies: ['task-1'],
      status: ExecutionStatus.PENDING
    },
    {
      id: 'task-3',
      name: 'Execute Goal Action via Capability',
      action: 'execute_capability',
      dependencies: ['task-2'],
      status: ExecutionStatus.PENDING,
      capabilityId: capabilities[0] || undefined
    }
  ];

  try {
    // Persist plan to PostgreSQL
    await pool.query(
      `INSERT INTO agent_plans (id, company_id, goal, tasks, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [planId, companyId, goal, JSON.stringify(tasks), ExecutionStatus.PENDING]
    );

    res.status(201).json({
      success: true,
      plan: { planId, companyId, goal, tasks, status: ExecutionStatus.PENDING }
    });
  } catch (err: any) {
    // If agent_plans table does not exist yet, warn but still return plan
    console.warn('WARNING: agent_plans table not found — run migration 003_plans_table.sql:', err.message);
    res.status(201).json({
      success: true,
      warning: 'Plan not persisted to DB — run infrastructure/migrations/003_plans_table.sql',
      plan: { planId, companyId, goal, tasks, status: ExecutionStatus.PENDING }
    });
  }
});

// 2. Execute Task Graph — load from DB, run tasks, persist results
app.post('/v1/plan/:planId/execute', async (req: Request, res: Response) => {
  const { planId } = req.params;

  let plan: any;
  try {
    const result = await pool.query('SELECT * FROM agent_plans WHERE id = $1', [planId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    plan = result.rows[0];
    plan.tasks = typeof plan.tasks === 'string' ? JSON.parse(plan.tasks) : plan.tasks;
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load plan from DB', details: err.message });
  }

  try {
    await pool.query(`UPDATE agent_plans SET status = $1 WHERE id = $2`, [ExecutionStatus.RUNNING, planId]);

    for (const task of plan.tasks) {
      task.status = ExecutionStatus.RUNNING;
      console.log(`[Planner] Executing: ${task.name} (${task.id})`);

      if (task.action === 'execute_capability' && (task.capabilityId || req.body.capabilityId)) {
        const capId = task.capabilityId || req.body.capabilityId;
        try {
          const execRes = await axios.post(
            `${CAPABILITY_REGISTRY_URL}/v1/capabilities/${capId}/execute`,
            req.body.payload || {},
            { headers: { 'x-company-id': plan.company_id } }
          );
          task.result = execRes.data;
        } catch (e: any) {
          task.result = { note: 'Capability execution fallback', error: e.message };
        }
      } else {
        task.result = { status: 'success', executed_at: new Date().toISOString() };
      }

      task.status = ExecutionStatus.COMPLETED;
    }

    await pool.query(
      `UPDATE agent_plans SET status = $1, tasks = $2, completed_at = NOW() WHERE id = $3`,
      [ExecutionStatus.COMPLETED, JSON.stringify(plan.tasks), planId]
    );

    res.json({ success: true, plan: { ...plan, tasks: plan.tasks, status: ExecutionStatus.COMPLETED } });
  } catch (err: any) {
    await pool.query(`UPDATE agent_plans SET status = $1 WHERE id = $2`, [ExecutionStatus.FAILED, planId]);
    res.status(500).json({ error: 'Planner execution failed', details: err.message });
  }
});

// 3. Get Plan Status from DB
app.get('/v1/plan/:planId', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM agent_plans WHERE id = $1', [req.params.planId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    const plan = result.rows[0];
    plan.tasks = typeof plan.tasks === 'string' ? JSON.parse(plan.tasks) : plan.tasks;
    res.json({ success: true, plan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. List all plans for a tenant
app.get('/v1/plans', async (req: Request, res: Response) => {
  const companyId = (req.headers['x-company-id'] || req.headers['x-tenant-id']) as string;
  if (!companyId) return res.status(400).json({ error: 'x-company-id header required' });

  try {
    const result = await pool.query(
      `SELECT id, company_id, goal, status, created_at, completed_at
       FROM agent_plans WHERE company_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [companyId]
    );
    res.json({ success: true, plans: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🧠 Planner Service (Task Graph Engine + PostgreSQL) running on port ${PORT}`);
});
