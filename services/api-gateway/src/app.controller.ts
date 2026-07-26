import { Controller, All, Req, Res, Get } from '@nestjs/common';
import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { proxyTo } from './proxy.util';

@Controller()
export class AppController {
  private authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:5001';
  private tenantServiceUrl = process.env.TENANT_SERVICE_URL || 'http://tenant-service:5002';
  private agentBuilderUrl = process.env.AGENT_BUILDER_URL || 'http://agent-builder:5003';
  private toolEngineUrl = process.env.TOOL_ENGINE_URL || 'http://tool-engine:5004';
  private orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://orchestrator:6000';
  private connectorHubUrl = process.env.CONNECTOR_HUB_URL || 'http://connector-hub:5005';
  private knowledgeServiceUrl = process.env.KNOWLEDGE_SERVICE_URL || 'http://knowledge-service:5006';

  // ── Legacy /api/* ──────────────────────────────────────────────────────────

  @All('api/auth*')
  proxyAuth(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.authServiceUrl, req, res);
  }

  @All('api/clients*')
  proxyClients(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.authServiceUrl, req, res);
  }

  @All('api/tenant*')
  proxyTenant(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.tenantServiceUrl, req, res);
  }

  @All('api/contact')
  proxyContact(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.tenantServiceUrl, req, res);
  }

  @All('api/crm*')
  proxyCrm(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.tenantServiceUrl, req, res);
  }

  @All('api/builder*')
  proxyBuilder(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.agentBuilderUrl, req, res);
  }

  @All('api/tools*')
  proxyTools(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.toolEngineUrl, req, res);
  }

  @All('api/connectors*')
  proxyConnectors(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.connectorHubUrl, req, res, (url) =>
      url.replace(/^\/api\/connectors/, '/api/connector-hub'),
    );
  }

  @All('api/connector-hub*')
  proxyConnectorHub(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.connectorHubUrl, req, res);
  }

  @All('api/knowledge*')
  proxyKnowledge(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.knowledgeServiceUrl, req, res);
  }

  // ── Canonical /v1/* (Phase 2) ──────────────────────────────────────────────

  @All('v1/auth*')
  proxyAuthV1(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.authServiceUrl, req, res);
  }

  @All('v1/keys*')
  proxyKeysV1(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.tenantServiceUrl, req, res, (url) =>
      url.replace(/^\/v1\/keys/, '/api/tenant/keys'),
    );
  }

  @All('v1/agents*')
  proxyAgentsV1(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.agentBuilderUrl, req, res, (url) =>
      url.replace(/^\/v1\/agents/, '/api/builder/agents'),
    );
  }

  @All('v1/calls*')
  proxyCallsV1(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.orchestratorUrl, req, res);
  }

  @All('v1/numbers*')
  proxyNumbersV1(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.tenantServiceUrl, req, res, (url) =>
      url.replace(/^\/v1\/numbers/, '/api/tenant/numbers'),
    );
  }

  @All('v1/knowledge*')
  proxyKnowledgeV1(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.knowledgeServiceUrl, req, res, (url) =>
      url.replace(/^\/v1\/knowledge/, '/api/knowledge'),
    );
  }

  @All('v1/usage*')
  proxyUsageV1(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.tenantServiceUrl, req, res, (url) =>
      url.replace(/^\/v1\/usage/, '/api/tenant/usage'),
    );
  }

  @All('v1/billing*')
  proxyBillingV1(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.tenantServiceUrl, req, res, (url) =>
      url.replace(/^\/v1\/billing/, '/api/tenant/billing'),
    );
  }

  @All('v1/pricing')
  proxyPricingV1(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.tenantServiceUrl, req, res, () => '/api/tenant/pricing');
  }

  @All('v1/tools*')
  proxyToolsV1(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.toolEngineUrl, req, res, (url) =>
      url.replace(/^\/v1\/tools/, '/api/tools'),
    );
  }

  @All('v1/connectors*')
  proxyConnectorsV1(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.connectorHubUrl, req, res, (url) => {
      // /v1/connectors → /api/connector-hub/integrations
      // /v1/connectors/:id/upload → /api/connector-hub/integrations/:id/upload
      const cleaned = url.replace(/^\/v1\/connectors/, '');
      if (cleaned === '' || cleaned.startsWith('?')) {
        return `/api/connector-hub/integrations${cleaned}`;
      }
      return `/api/connector-hub/integrations${cleaned}`;
    });
  }

  @All('v1/onboarding*')
  proxyOnboardingV1(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.tenantServiceUrl, req, res, (url) =>
      url.replace(/^\/v1\/onboarding/, '/api/tenant/onboarding'),
    );
  }

  @All('v1/workflow-settings*')
  proxyWorkflowSettingsV1(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.tenantServiceUrl, req, res, (url) =>
      url.replace(/^\/v1\/workflow-settings/, '/api/tenant/workflow-settings'),
    );
  }

  // ── Telephony webhooks (public) ────────────────────────────────────────────

  @All('incoming-call')
  proxyIncomingCall(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.orchestratorUrl, req, res);
  }

  @All('handle-input')
  proxyHandleInput(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.orchestratorUrl, req, res);
  }

  @All('stream-response')
  proxyStreamResponse(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.orchestratorUrl, req, res);
  }

  @All('twilio*')
  proxyTwilio(@Req() req: Request, @Res() res: Response) {
    return proxyTo(this.orchestratorUrl, req, res);
  }

  @All('health')
  getHealth(@Req() req: Request, @Res() res: Response) {
    return res.json({ status: 'OK', gateway: 'api-gateway' });
  }

  // Static OpenAPI + docs (public)
  @Get(['openapi.yaml', 'v1/openapi.yaml'])
  getOpenApi(@Res() res: Response) {
    const candidates = [
      path.join(process.cwd(), 'openapi.yaml'),
      path.join(__dirname, '..', 'openapi.yaml'),
      '/openapi.yaml',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        res.setHeader('Content-Type', 'application/yaml');
        return res.sendFile(path.resolve(p));
      }
    }
    return res.status(404).json({ error: 'openapi.yaml not found' });
  }

  @Get(['docs', 'docs/', 'v1/docs'])
  getDocs(@Res() res: Response) {
    return res.type('html').send(`<!DOCTYPE html>
<html>
<head>
  <title>Markova API Docs</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({ url: '/openapi.yaml', dom_id: '#swagger-ui', deepLinking: true });
  </script>
</body>
</html>`);
  }

  // Public pricing page (no login) — Phase 3
  @Get(['pricing', 'pricing/'])
  getPricingPage(@Res() res: Response) {
    return res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Markova Pricing</title>
  <style>
    :root { --ink:#14201a; --muted:#4a5c52; --bg:#f3f6f2; --card:#fff; --line:#d5e0d8; --accent:#0f6b4c; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: "Segoe UI", system-ui, sans-serif; color:var(--ink); background:
      radial-gradient(circle at 10% 0%, #e7f3ec, transparent 40%),
      radial-gradient(circle at 90% 10%, #f7efe3, transparent 35%), var(--bg); }
    main { max-width: 980px; margin: 0 auto; padding: 48px 20px 80px; }
    h1 { font-size: clamp(2rem, 4vw, 3rem); letter-spacing: -0.03em; margin: 0 0 8px; }
    .lede { color: var(--muted); font-size: 1.1rem; max-width: 42rem; line-height: 1.5; }
    .meta { margin: 24px 0 32px; color: var(--muted); font-size: 0.95rem; }
    .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .tier { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 22px; }
    .tier h2 { margin: 0 0 6px; font-size: 1.35rem; }
    .price { font-size: 1.8rem; font-weight: 700; color: var(--accent); margin: 12px 0; }
    .price small { font-size: 0.85rem; font-weight: 500; color: var(--muted); }
    ul { padding-left: 1.1rem; margin: 0; color: var(--muted); line-height: 1.55; }
    .sandbox { margin-top: 28px; padding: 18px 20px; border-left: 4px solid var(--accent); background: #eef7f2; }
    a.json { color: var(--accent); }
  </style>
</head>
<body>
  <main>
    <h1>Markova pricing</h1>
    <p class="lede">Usage-based voice agents in Ethiopian Birr. Same API in sandbox and live — pay for live minutes, not seats.</p>
    <p class="meta">Currency: <strong>ETB</strong> · Billed per minute · Overage auto-billed (no mid-call hard stop) · <a class="json" href="/v1/pricing">JSON</a></p>
    <div class="grid" id="tiers"></div>
    <div class="sandbox" id="sandbox"></div>
  </main>
  <script>
    fetch('/v1/pricing').then(r => r.json()).then(data => {
      const root = document.getElementById('tiers');
      root.innerHTML = (data.tiers || []).map(t => {
        const inbound = t.price_etb_per_minute_inbound != null ? t.price_etb_per_minute_inbound + ' ETB/min inbound' : '';
        const outbound = t.price_etb_per_minute_outbound != null
          ? t.price_etb_per_minute_outbound + ' ETB/min outbound'
          : (t.outbound_minutes_included != null ? t.outbound_minutes_included + ' outbound min included' : '');
        return '<article class="tier"><h2>' + t.name + '</h2>'
          + '<div class="price">' + (t.price_etb_per_minute_inbound ?? '—') + ' <small>ETB/min</small></div>'
          + '<ul>'
          + '<li>' + (t.summary || '') + '</li>'
          + '<li>' + inbound + (outbound ? ' · ' + outbound : '') + '</li>'
          + '<li>Concurrent agents: ' + t.concurrent_agents + '</li>'
          + '<li>Workflow execution: ' + (t.workflow_execution ? 'Yes' : 'Dashboard display only') + '</li>'
          + '<li>Support: ' + t.support + '</li>'
          + '</ul></article>';
      }).join('');
      const s = data.sandbox || {};
      document.getElementById('sandbox').innerHTML =
        '<strong>' + (s.name || 'Sandbox') + '</strong> — '
        + (s.price_etb_per_minute === 0 ? 'Free' : s.price_etb_per_minute + ' ETB/min')
        + '. ' + (s.notes || '')
        + (data.add_ons && data.add_ons[0]
          ? '<br/>Add-on: ' + data.add_ons[0].name + ' at ' + data.add_ons[0].price_etb + ' ETB.'
          : '')
        + (data.annual_discount_percent
          ? '<br/>Annual billing discount: ' + data.annual_discount_percent + '%.'
          : '');
    }).catch(() => {
      document.getElementById('tiers').textContent = 'Unable to load pricing.';
    });
  </script>
</body>
</html>`);
  }
}
