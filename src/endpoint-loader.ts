import fs from 'fs';
import path from 'path';
import { Endpoint } from './types.js';

export class EndpointLoader {
  private static instance: EndpointLoader;
  private endpoints: Endpoint[] = [];

  private constructor() {
    this.loadEndpoints();
  }

  public static getInstance(): EndpointLoader {
    if (!EndpointLoader.instance) {
      EndpointLoader.instance = new EndpointLoader();
    }
    return EndpointLoader.instance;
  }

  private loadEndpoints(): void {
    try {
      const endpointsPath = path.join(__dirname, 'endpoints.json');
      const endpointsData = fs.readFileSync(endpointsPath, 'utf8');
      const { endpoints } = JSON.parse(endpointsData);
      this.endpoints = endpoints;
    } catch (error) {
      console.warn('Could not load endpoints.json, using default endpoints');
      this.endpoints = this.getDefaultEndpoints();
    }
  }

  private getDefaultEndpoints(): Endpoint[] {
    return [
      {
        path: "/catalogs",
        description: "Get a list of available catalogs",
        params: []
      }
    ];
  }

  public getEndpoints(): Endpoint[] {
    return this.endpoints;
  }

  public getEndpoint(path: string): Endpoint | undefined {
    return this.endpoints.find(endpoint => endpoint.path === path);
  }
}
