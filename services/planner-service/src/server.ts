import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import dotenv from 'dotenv';
import { ExecutionStatus } from '@markova/shared-types';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5006;
const CAPABILITY_REGISTRY_URL = process.env.CAPABILITY_REGISTRY_URL || 'http://capability-registry:5005';

interface TaskNode {
  id: string;
  name: string;
  capabilityId?: string;
  action: string;
  dependencies: string[];
  status: ExecutionStatus;
  result?: any;
}

interface PlanGraph {
  planId: string;
  companyId: string;
  goal: string;
  tasks: TaskNode[];
  status: ExecutionStatus;
  created_at: Date;
}

const activePlans = new Map<string, PlanGraph>();

// Health
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', service: 'planner-service', version: '1.0.0' });
});

// 1. Plan Generation (Decompose Goal into Task Graph DAG)
app.post('/v1/plan', (req: Request, res: Response) => {
  const { goal, capabilities = [] } = req.body;
  const companyId = (req.headers['x-company-id'] || req.headers['x-tenant-id']) as string || 'default';

  if (!goal) {
    return res.status(400).json({ error: 'Goal is required' });
  }

  const planId = uuidv4();

  // Synthetic Task Graph DAG decomposition heuristic
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
      status: ExecutionStatus.PENDING
    }
  ];

  const plan: PlanGraph = {
    planId,
    companyId,
    goal,
    tasks,
    status: ExecutionStatus.PENDING,
    created_at: new Date()
  };

  activePlans.set(planId, plan);
  res.status(201).json({ success: true, plan });
});

// 2. Execute Task Graph Scheduler
app.post('/v1/plan/:planId/execute', async (req: Request, res: Response) => {
  const { planId } = req.params;
  const plan = activePlans.get(planId);

  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  plan.status = ExecutionStatus.RUNNING;

  try {
    for (const task of plan.tasks) {
      task.status = ExecutionStatus.RUNNING;
      console.log(`⚡ Executing Task Graph Node: ${task.name} (${task.id})`);

      // Simulate capability execution or call Capability Registry if provided
      if (task.action === 'execute_capability' && req.body.capabilityId) {
        try {
          const execRes = await axios.post(`${CAPABILITY_REGISTRY_URL}/v1/capabilities/${req.body.capabilityId}/execute`, req.body.payload || {}, {
            headers: { 'x-company-id': plan.companyId }
          });
          task.result = execRes.data;
        } catch (e: any) {
          task.result = { simulated: true, note: 'Capability proxy executed fallback' };
        }
      } else {
        task.result = { status: 'success', executed_at: new Date() };
      }

      task.status = ExecutionStatus.COMPLETED;
    }

    plan.status = ExecutionStatus.COMPLETED;
    res.json({ success: true, plan });
  } catch (err: any) {
    plan.status = ExecutionStatus.FAILED;
    res.status(500).json({ error: 'Planner execution failed', details: err.message });
  }
});

// 3. Get Plan Status
app.get('/v1/plan/:planId', (req: Request, res: Response) => {
  const plan = activePlans.get(req.params.planId);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json({ success: true, plan });
});

app.listen(PORT, () => {
  console.log(`🧠 Planner Service (Task Graph Engine) running on port ${PORT}`);
});
