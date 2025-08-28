import { request } from 'obsidian';
import { Logger } from './logger';

export async function corsBypassingFetch(url: string, options?: RequestInit): Promise<Response> {
    try {
        const responseText = await request({
            url,
            method: options?.method || 'GET',
            headers: options?.headers as Record<string, string>,
            body: options?.body as string,
        });

        // Create a Response object that mimics the browser's Response
        const response = new Response(responseText, {
            status: 200, // Assuming success; Obsidian's request throws on non-2xx
            statusText: 'OK',
            headers: { 'Content-Type': 'application/xml' } // Assuming XML for RSS
        });

        return response;
    } catch (error) {
        const status = error?.status || 500;
        Logger.error(`Request to ${url} failed with status ${status}`, error);

        // Return a Response object indicating failure
        return new Response(`Failed to fetch ${url}: ${error.message}`, {
            status: status,
            statusText: error?.statusText || 'Request failed'
        });
    }
}