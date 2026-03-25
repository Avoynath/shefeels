import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { Notification } from '../components/Modal';

export default function ChatLogs() {
  // Currently only using CHAT_GEN_PROMPT_NSFW - other state variables disabled for now
  // const [chatGuardrail, setChatGuardrail] = useState('');
  const [chatNsfw, setChatNsfw] = useState('');
  // const [imageGuardrail, setImageGuardrail] = useState('');
  // const [imageSystem, setImageSystem] = useState('');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });

  useEffect(() => {
    (async () => {
      try {
        const configs = await apiService.getConfigs();
        const cfgArr = Array.isArray(configs) ? configs : [];
        // Backend may return parameter_name or key - check both
        const getConfigKey = (c: any) => c.parameter_name || c.key;
        // const chatG = cfgArr.find((c: any) => getConfigKey(c) === 'CHAT_GEN_GUARDRAIL');
        const chatN = cfgArr.find((c: any) => getConfigKey(c) === 'CHAT_GEN_PROMPT_NSFW');
        // const imgG = cfgArr.find((c: any) => getConfigKey(c) === 'IMAGE_GEN_GUARDRAIL');
        // const imgS = cfgArr.find((c: any) => getConfigKey(c) === 'IMAGE_GEN_SYSTEM_PROMPT');
        // setChatGuardrail(chatG?.parameter_value || '');
        setChatNsfw(chatN?.parameter_value || '');
        // setImageGuardrail(imgG?.parameter_value || '');
        // setImageSystem(imgS?.parameter_value || '');
      } catch (e) {
        console.error('getConfigs', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async (key: string, value: string) => {
    try {
      const configs = await apiService.getConfigs();
      const cfgArr = Array.isArray(configs) ? configs : [];
      // Backend may return parameter_name or key - check both
      const cfg = cfgArr.find((c: any) => (c.parameter_name || c.key) === key);
      if (cfg) {
        await apiService.updateConfig(cfg.id, { parameter_value: value, parameter_description: cfg.parameter_description || '' });
        setNotification({ show: true, message: `${key} updated successfully`, type: 'success' });
      } else {
        setNotification({ show: true, message: `Configuration ${key} not found`, type: 'error' });
      }
    } catch (e) {
      console.error('updateConfig', e);
      setNotification({ show: true, message: `Failed to update ${key}`, type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">System Prompts</h1>

      {loading && <div className="text-gray-500">Loading configurations...</div>}

      {!loading && (
        <>
          {/* Chat System Prompt */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Chat System Prompt</h2>
            <div className="space-y-4">
              {/* CHAT_GEN_GUARDRAIL - Disabled for now
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CHAT_GEN_GUARDRAIL</label>
                <textarea
                  value={chatGuardrail}
                  onChange={(e) => setChatGuardrail(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter chat generation guardrail prompt..."
                />
                <button
                  onClick={() => handleSave('CHAT_GEN_GUARDRAIL', chatGuardrail)}
                  className="mt-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Save
                </button>
              </div>
              */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CHAT_GEN_PROMPT_NSFW</label>
                <textarea
                  value={chatNsfw}
                  onChange={(e) => setChatNsfw(e.target.value)}
                  rows={16}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="Enter NSFW chat prompt..."
                />
                <button
                  onClick={() => handleSave('CHAT_GEN_PROMPT_NSFW', chatNsfw)}
                  className="mt-3 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* Image Moderation - Disabled for now
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Image Moderation</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">IMAGE_GEN_GUARDRAIL</label>
                <textarea
                  value={imageGuardrail}
                  onChange={(e) => setImageGuardrail(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter image generation guardrail..."
                />
                <button
                  onClick={() => handleSave('IMAGE_GEN_GUARDRAIL', imageGuardrail)}
                  className="mt-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Save
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">IMAGE_GEN_SYSTEM_PROMPT</label>
                <textarea
                  value={imageSystem}
                  onChange={(e) => setImageSystem(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter image system prompt..."
                />
                <button
                  onClick={() => handleSave('IMAGE_GEN_SYSTEM_PROMPT', imageSystem)}
                  className="mt-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
          */}
        </>
      )}

      {notification.show && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification({ ...notification, show: false })}
        />
      )}
    </div>
  );
}
