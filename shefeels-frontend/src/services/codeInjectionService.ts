
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface BootstrapResponse {
  config: {
    head_scripts?: string | null;
    body_scripts?: string | null;
    [key: string]: any;
  };
}

export const injectScripts = async () => {
  try {
    const response = await axios.get<BootstrapResponse>(`${API_URL}/api/v1/bootstrap`);
    const { head_scripts, body_scripts } = response.data.config;

    if (head_scripts) {
      safeInject(head_scripts, document.head, 'Head');
    }

    if (body_scripts) {
      safeInject(body_scripts, document.body, 'Body');
    }
  } catch (error) {
    console.error('[CodeInjection] Failed to fetch or inject scripts:', error);
  }
};

const safeInject = (html: string, target: HTMLElement, label: string) => {
  try {
    if (!html || typeof html !== 'string') return;
    
    // Create a Range object to parse the HTML string into a DocumentFragment
    const range = document.createRange();
    
    // Set the context to the target element (head or body)
    range.selectNode(target);
    
    // Create the fragment
    // Note: This relies on browser's forgiving HTML parser.
    // Invalid tags may be ignored but won't typically throw.
    const fragment = range.createContextualFragment(html);
    
    // Append the fragment to the target
    target.appendChild(fragment);
    
    console.log(`[CodeInjection] ${label} scripts injected successfully.`);
  } catch (e) {
    console.error(`[CodeInjection] Failed to inject ${label} scripts:`, e);
    // Suppress error to prevent app crash
  }
};
