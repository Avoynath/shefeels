
import { useEffect, useState } from 'react';
import { Notification } from '../components/Modal';
import { apiService } from '../services/api';

interface AppConfig {
  id: number;
  category: string;
  parameter_name: string;
  parameter_value: string;
  parameter_description?: string;
}

export default function CodeInjections() {
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  
  const [headScript, setHeadScript] = useState<{ id: number | null, value: string }>({ id: null, value: '' });
  const [bodyScript, setBodyScript] = useState<{ id: number | null, value: string }>({ id: null, value: '' });

  const fetchScripts = async () => {
    try {
      setLoading(true);
      const data = await apiService.getConfigs();
      
      const head = data.find((c: any) => c.parameter_name === 'head_scripts');
      const body = data.find((c: any) => c.parameter_name === 'body_scripts');
      
      setHeadScript({ id: head?.id || null, value: head?.parameter_value || '' });
      setBodyScript({ id: body?.id || null, value: body?.parameter_value || '' });
      
    } catch (e) {
      console.error('Failed to fetch scripts:', e);
      setNotification({ show: true, message: 'Failed to load scripts', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchScripts(); }, []);

  const handleSave = async (section: 'head' | 'body') => {
    const target = section === 'head' ? headScript : bodyScript;
    const parameterName = section === 'head' ? 'head_scripts' : 'body_scripts';
    const description = section === 'head' ? 'Scripts injected into <head>' : 'Scripts injected into <body>';
    
    try {
      if (target.id) {
        // Update existing
        await apiService.updateConfig(String(target.id), {
          parameter_value: target.value,
          parameter_description: description
        });
      } else {
        // Create new
        await apiService.createConfig({
          category: 'scripts',
          parameter_name: parameterName,
          parameter_value: target.value,
          parameter_description: description
        });
        
        // Refresh to get ID
        await fetchScripts();
      }
      
      setNotification({ show: true, message: `${section.toUpperCase()} script saved successfully`, type: 'success' });
    } catch (e: any) {
      setNotification({ show: true, message: e.message || 'Failed to save script', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Code Injections</h1>
        <p className="text-sm text-gray-600 mt-1">Inject custom HTML/CSS/JS code into different sections of your public site. (Analytics, Chat widgets, etc.)</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-600">Loading...</div>
      ) : (
        <>
          {/* Head Section */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Head Section</h2>
                <p className="text-sm text-gray-600">Injected into {'<head>'} tag. Ideal for meta tags, GTM, etc.</p>
              </div>
              <button
                onClick={() => handleSave('head')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Save Head
              </button>
            </div>
            <textarea
              value={headScript.value}
              onChange={(e) => setHeadScript({ ...headScript, value: e.target.value })}
              rows={8}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm bg-gray-50 focus:bg-white transition-colors"
              placeholder={'<!-- Example -->\n<script>\n  console.log("Hello from Head");\n</script>'}
            />
          </div>

          {/* Body Start */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Body Section</h2>
                <p className="text-sm text-gray-600">Injected into {'<body>'} tag.</p>
              </div>
              <button
                onClick={() => handleSave('body')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Save Body
              </button>
            </div>
            <textarea
              value={bodyScript.value}
              onChange={(e) => setBodyScript({ ...bodyScript, value: e.target.value })}
              rows={8}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm bg-gray-50 focus:bg-white transition-colors"
              placeholder={'<!-- Example -->\n<script src="..."></script>'}
            />
          </div>
        </>
      )}

      {notification.show && (
        <Notification message={notification.message} type={notification.type} onClose={() => setNotification({...notification, show: false})} />
      )}
    </div>
  );
}
