import { useNavigate } from 'react-router-dom';

export default function ActivationFailed() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Activation Failed</h1>
          <p className="text-gray-600">
            We couldn't activate your account. The activation link may have expired or is invalid.
          </p>
        </div>

        <div className="space-y-4 text-left bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-gray-900">Possible reasons:</h3>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
            <li>The activation link has expired (links are valid for 24 hours)</li>
            <li>The link has already been used</li>
            <li>The account has been disabled</li>
            <li>Invalid or corrupted activation token</li>
          </ul>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/admin')}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Go to Login
          </button>
          <button
            onClick={() => window.location.href = 'mailto:support@honeylove.ai?subject=Account Activation Failed'}
            className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}
