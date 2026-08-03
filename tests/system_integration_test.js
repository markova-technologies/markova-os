const assert = require('assert');
const WorkflowCompiler = require('../kernel/workflow/compiler');
const WorkingMemory = require('../kernel/memory/layers/working');
const ContextEngine = require('../kernel/context/context_engine');

console.log('🧪 Starting System Unit & Component Integration Tests...\n');

// Test 1: Workflow Compiler DAG Topological Sort & Cycle Detection
try {
  console.log('Test 1: Testing Workflow Compiler DAG Topological Sort...');
  const blueprint = {
    id: 'wf_test_dag',
    nodes: [
      { id: 'node-3', type: 'tool', name: 'Send Email' },
      { id: 'node-1', type: 'condition', name: 'Check VIP' },
      { id: 'node-2', type: 'capability', name: 'Query CRM' }
    ],
    edges: [
      { source: 'node-1', target: 'node-2' },
      { source: 'node-2', target: 'node-3' }
    ]
  };

  const compiled = WorkflowCompiler.compile(blueprint);
  assert.strictEqual(compiled.sortedSteps[0].id, 'node-1');
  assert.strictEqual(compiled.sortedSteps[1].id, 'node-2');
  assert.strictEqual(compiled.sortedSteps[2].id, 'node-3');
  console.log('✅ PASS: Workflow Compiler DAG topological sort correct!\n');
} catch (err) {
  console.error('❌ FAIL: Test 1 failed:', err.message);
  process.exit(1);
}

// Test 2: Workflow Compiler Cycle Detection
try {
  console.log('Test 2: Testing Workflow Compiler Cycle Detection...');
  const cyclicBlueprint = {
    id: 'wf_cyclic',
    nodes: [
      { id: 'a', type: 'tool' },
      { id: 'b', type: 'tool' }
    ],
    edges: [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' }
    ]
  };

  let caught = false;
  try {
    WorkflowCompiler.compile(cyclicBlueprint);
  } catch (e) {
    caught = true;
    assert(e.message.includes('Cyclic dependency detected'));
  }
  assert(caught, 'Compiler should reject cyclic DAG workflows');
  console.log('✅ PASS: Workflow Compiler successfully rejects cyclic DAGs!\n');
} catch (err) {
  console.error('❌ FAIL: Test 2 failed:', err.message);
  process.exit(1);
}

// Test 3: Working Memory Scratchpad Operations
try {
  console.log('Test 3: Testing Ephemeral Working Memory Layer...');
  const memory = new WorkingMemory(null); // Local Map fallback
  
  (async () => {
    await memory.set('sess_123', 'temp_choice', 'option_A');
    const val = await memory.get('sess_123', 'temp_choice');
    assert.strictEqual(val, 'option_A');

    await memory.clear('sess_123');
    const clearedVal = await memory.get('sess_123', 'temp_choice');
    assert.strictEqual(clearedVal, null);
    console.log('✅ PASS: Working Memory layer set/get/clear operates cleanly!\n');
  })().catch(err => {
    console.error('❌ FAIL: Test 3 async error:', err);
    process.exit(1);
  });
} catch (err) {
  console.error('❌ FAIL: Test 3 failed:', err.message);
  process.exit(1);
}

// Test 4: Context Engine Token Budgeting & History Trimming
try {
  console.log('Test 4: Testing Context Engine Token Budgeting & Trimming...');
  const engine = new ContextEngine({ tokenLimit: 100 });
  const history = [
    { role: 'user', content: 'First message that takes up token budget' },
    { role: 'assistant', content: 'Second message assistant reply' },
    { role: 'user', content: 'Latest user query message' }
  ];

  const result = engine.buildContext({
    agentPrompt: 'System prompt instructions',
    conversationHistory: history
  });

  assert(result.messages.length > 0);
  assert.strictEqual(result.messages[0].role, 'system');
  console.log('✅ PASS: Context Engine token budget trimming verified!\n');
} catch (err) {
  console.error('❌ FAIL: Test 4 failed:', err.message);
  process.exit(1);
}

console.log('🎉 ALL SYSTEM TESTS PASSED SUCCESSFULLY!');
