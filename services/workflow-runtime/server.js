const express = require('express');
const cors = require('cors');
const WorkflowCompiler = require('../../kernel/workflow/compiler');
const EventBus = require('../../kernel/events/bus');
const { EventTypes } = require('../../kernel/events/registry');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 6005;
const eventBus = new EventBus(process.env.REDIS_URL || 'redis://redis:6379');

// Execute a Workflow
app.post('/api/workflow/execute', async (req, res) => {
  const { workflowId, blueprint, context } = req.body;
  const companyId = req.headers['x-company-id'];

  if (!companyId || !blueprint) {
    return res.status(400).json({ error: 'Company ID and blueprint are required' });
  }

  try {
    const compiled = WorkflowCompiler.compile(blueprint);
    
    // Simulate async execution
    const result = await compiled.execute(context);

    await eventBus.publish(EventTypes.WORKFLOW_FINISHED, {
      tenantId: companyId,
      workflowId: compiled.id,
      success: true,
      result
    }, { source: 'workflow-runtime' });

    res.json({ success: true, result });
  } catch (error) {
    console.error('Workflow execution error:', error);
    
    await eventBus.publish('workflow.failed', {
      tenantId: companyId,
      workflowId: workflowId || 'unknown',
      success: false,
      error: error.message
    }, { source: 'workflow-runtime' });

    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'workflow-runtime' });
});

app.listen(PORT, () => {
  console.log(`🚀 Workflow Runtime listening on port ${PORT}`);
});
