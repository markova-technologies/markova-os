import { Controller, All, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import * as proxy from 'express-http-proxy';

@Controller()
export class AppController {
  private authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:5001';
  private tenantServiceUrl = process.env.TENANT_SERVICE_URL || 'http://tenant-service:5002';
  private agentBuilderUrl = process.env.AGENT_BUILDER_URL || 'http://agent-builder:5003';
  private toolEngineUrl = process.env.TOOL_ENGINE_URL || 'http://tool-engine:5004';
  private orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://orchestrator:6000';
  private connectorHubUrl = process.env.CONNECTOR_HUB_URL || 'http://connector-hub:5005';
  private knowledgeServiceUrl = process.env.KNOWLEDGE_SERVICE_URL || 'http://knowledge-service:5006';

  @All('api/auth*')
  proxyAuth(@Req() req: Request, @Res() res: Response) {
    return proxy(this.authServiceUrl)(req, res);
  }

  @All('api/tenant*')
  proxyTenant(@Req() req: Request, @Res() res: Response) {
    return proxy(this.tenantServiceUrl)(req, res);
  }

  @All('api/contact')
  proxyContact(@Req() req: Request, @Res() res: Response) {
    return proxy(this.tenantServiceUrl)(req, res);
  }

  @All('api/crm*')
  proxyCrm(@Req() req: Request, @Res() res: Response) {
    return proxy(this.tenantServiceUrl)(req, res);
  }

  @All('api/builder*')
  proxyBuilder(@Req() req: Request, @Res() res: Response) {
    return proxy(this.agentBuilderUrl)(req, res);
  }

  @All('api/tools*')
  proxyTools(@Req() req: Request, @Res() res: Response) {
    return proxy(this.toolEngineUrl)(req, res);
  }

  @All('api/connectors*')
  proxyConnectors(@Req() req: Request, @Res() res: Response) {
    return proxy(this.connectorHubUrl)(req, res);
  }

  @All('api/knowledge*')
  proxyKnowledge(@Req() req: Request, @Res() res: Response) {
    return proxy(this.knowledgeServiceUrl)(req, res);
  }

  @All('incoming-call')
  proxyIncomingCall(@Req() req: Request, @Res() res: Response) {
    return proxy(this.orchestratorUrl)(req, res);
  }

  @All('handle-input')
  proxyHandleInput(@Req() req: Request, @Res() res: Response) {
    return proxy(this.orchestratorUrl)(req, res);
  }

  @All('stream-response')
  proxyStreamResponse(@Req() req: Request, @Res() res: Response) {
    return proxy(this.orchestratorUrl)(req, res);
  }

  @All('health')
  getHealth(@Req() req: Request, @Res() res: Response) {
    return res.json({ status: 'OK', gateway: 'api-gateway' });
  }
}
