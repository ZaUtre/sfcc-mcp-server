/**
 * Type definitions for SFCC MCP Server
 */

export interface EndpointParam {
  name: string;
  description: string;
  type: string;
  required: boolean;
}

export interface Endpoint {
  path: string;
  description: string;
  params: EndpointParam[];
  method?: string;
  defaultBody?: any;
  toolName?: string;
}

export interface TokenResponse {
  access_token: string;
  scope?: string;
  token_type: string;
  expires_in: number;
}

export interface SFCCConfig {
  adminClientId: string;
  adminClientSecret: string;
  apiBase: string;
  userAgent: string;
  ocapiVersion: string;
}

export interface SearchQuery {
  query?: any;
  expand?: string[];
  inventory_ids?: string[];
  count?: number;
  start?: number;
  select?: string;
}

export type CustomHandler = (endpoint: Endpoint, params: Record<string, any>, sessionId?: string) => Promise<any>;
