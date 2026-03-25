import { useEffect, useState } from 'react'
import { Modal, ConfirmDialog } from './Modal'
import { apiService } from '../services/api'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  editCharacter?: any | null
}

const initial = {
  name: '', username: '', gender: 'female', style: '', ethnicity: '', age: '', eye_colour: '', hair_style: '', hair_colour: '', body_type: '', breast_size: '', butt_size: '', dick_size: '', personality: '', voice_type: '', relationship_type: '', clothing: '', special_features: '', avatar: null, hobbies: '', bio: '', prompt_enhanced: ''
}

export default function CreateCharacterModal({ open, onClose, onSuccess, editCharacter }: Props) {
  const [form, setForm] = useState<any>(initial)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [error, setError] = useState('')

  // Determine if we're in edit mode
  const isEditMode = !!editCharacter

  useEffect(() => {
    if (open) {
      if (editCharacter) {
        setForm({
          name: editCharacter.name || '',
          username: editCharacter.username || '',
          gender: (editCharacter.gender || 'female'),
          style: editCharacter.style || '',
          ethnicity: editCharacter.ethnicity || '',
          age: editCharacter.age || '',
          eye_colour: editCharacter.eye_colour || '',
          hair_style: editCharacter.hair_style || '',
          hair_colour: editCharacter.hair_colour || '',
          body_type: editCharacter.body_type || '',
          breast_size: editCharacter.breast_size || '',
          butt_size: editCharacter.butt_size || '',
          dick_size: editCharacter.dick_size || '',
          personality: editCharacter.personality || '',
          voice_type: editCharacter.voice_type || '',
          relationship_type: editCharacter.relationship_type || '',
          clothing: editCharacter.clothing || '',
          special_features: editCharacter.special_features || '',
          avatar: (editCharacter as any)?.avatar || null,
          hobbies: editCharacter.hobbies || '',
          bio: editCharacter.bio || '',
          prompt_enhanced: editCharacter.prompt_enhanced || '',
        })
      } else {
        setForm(initial)
      }
      setError('')
    }
  }, [open, editCharacter])

  // fallback: assets hook may not exist in this repo yet — keep empty arrays
  const genderKey = (form.gender === 'male' ? 'male' : form.gender === 'trans' ? 'trans' : 'female')
  const ethnicityAssets: any[] = []
  const characterAssets: any[] = []

  const handle = (k: string, v: any) => setForm((s: any) => ({ ...s, [k]: v }))

  const submit = async (e?: any) => {
    e?.preventDefault()
    setError('')
    if (!form.name || !form.style) { setError('Name and style are required'); return }
    setLoading(true)
    setActionLoading(true)
    try {
      let payload: any

      if (editCharacter) {
        // In edit mode, only send editable fields
        payload = {
          name: form.name,
          username: form.username,
          hobbies: form.hobbies,
          bio: form.bio,
          prompt_enhanced: form.prompt_enhanced,
        }
      } else {
        // In create mode, send all fields
        payload = {
          name: form.name,
          username: form.username,
          gender: form.gender,
          style: form.style,
          ethnicity: form.ethnicity,
          age: form.age === '' ? null : Number(form.age),
          eye_colour: form.eye_colour,
          hair_style: form.hair_style,
          hair_colour: form.hair_colour,
          body_type: form.body_type,
          breast_size: form.breast_size || null,
          butt_size: form.butt_size || null,
          dick_size: form.dick_size || null,
          personality: form.personality,
          voice_type: form.voice_type,
          relationship_type: form.relationship_type,
          clothing: form.clothing,
          special_features: form.special_features,
          avatar: form.avatar || null,
          hobbies: form.hobbies,
          bio: form.bio,
          prompt_enhanced: form.prompt_enhanced,
        }
      }

      if (editCharacter) {
        await apiService.editCharacter(editCharacter.id, payload)
      } else {
        await apiService.createCharacter(payload)
      }

      onSuccess?.()
      onClose()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Failed to save character')
    } finally {
      setLoading(false)
      setActionLoading(false)
    }
  }

  return (
    <>
      <Modal
        isOpen={open}
        onClose={onClose}
        title={editCharacter ? `Edit Character: ${editCharacter.name}` : 'Create Character'}
        backdropClassName="bg-transparent"
        footer={
          <>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50" disabled={actionLoading}>
              Cancel
            </button>
            {editCharacter && (
              <button type="button" onClick={() => setConfirmDeleteOpen(true)} className="px-4 py-2 text-sm font-medium text-red-600 bg-red-100 rounded-lg hover:bg-red-200">
                Delete Character
              </button>
            )}
            <button type="button" onClick={submit} disabled={actionLoading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {actionLoading ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4 max-h-[70vh] overflow-auto p-2">
          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Editable Fields Section */}
            {isEditMode && (
              <div className="col-span-1 md:col-span-2 mb-2">
                <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Editable Fields</h3>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input className="w-full px-3 py-2 border rounded" value={form.name} onChange={(e) => handle('name', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <input className="w-full px-3 py-2 border rounded" value={form.username} onChange={(e) => handle('username', e.target.value)} />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Hobbies</label>
              <input className="w-full px-3 py-2 border rounded" value={form.hobbies} onChange={(e) => handle('hobbies', e.target.value)} placeholder="e.g. Reading, Gaming, Sports" />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Bio</label>
              <textarea rows={3} className="w-full px-3 py-2 border rounded" value={form.bio} onChange={(e) => handle('bio', e.target.value)} placeholder="Character biography..." />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Prompt Enhanced</label>
              <textarea rows={4} className="w-full px-3 py-2 border rounded" value={form.prompt_enhanced} onChange={(e) => handle('prompt_enhanced', e.target.value)} placeholder="Enhanced prompt details..." />
            </div>

            {/* Read-only Fields Section (in edit mode) */}
            {isEditMode && (
              <div className="col-span-1 md:col-span-2 mt-4 mb-2">
                <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Read-only Fields</h3>
                <p className="text-xs text-gray-500 mt-1">These fields cannot be modified after character creation.</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Gender</label>
              <select
                className={`w-full px-3 py-2 border rounded ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={form.gender}
                onChange={(e) => handle('gender', e.target.value)}
                disabled={isEditMode}
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="trans">Trans</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Style</label>
              <input
                className={`w-full px-3 py-2 border rounded ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={form.style}
                onChange={(e) => handle('style', e.target.value)}
                readOnly={isEditMode}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Ethnicity</label>
              <input
                className={`w-full px-3 py-2 border rounded ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={form.ethnicity}
                onChange={(e) => handle('ethnicity', e.target.value)}
                placeholder="e.g. White"
                readOnly={isEditMode}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Age</label>
              <input
                className={`w-full px-3 py-2 border rounded ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={form.age}
                onChange={(e) => handle('age', e.target.value)}
                readOnly={isEditMode}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Eye Colour</label>
              <input
                className={`w-full px-3 py-2 border rounded ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={form.eye_colour}
                onChange={(e) => handle('eye_colour', e.target.value)}
                readOnly={isEditMode}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Hair Style</label>
              <input
                className={`w-full px-3 py-2 border rounded ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={form.hair_style}
                onChange={(e) => handle('hair_style', e.target.value)}
                readOnly={isEditMode}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Hair Colour</label>
              <input
                className={`w-full px-3 py-2 border rounded ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={form.hair_colour}
                onChange={(e) => handle('hair_colour', e.target.value)}
                readOnly={isEditMode}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Body Type</label>
              <input
                className={`w-full px-3 py-2 border rounded ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={form.body_type}
                onChange={(e) => handle('body_type', e.target.value)}
                readOnly={isEditMode}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Breast Size</label>
              <input
                className={`w-full px-3 py-2 border rounded ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={form.breast_size}
                onChange={(e) => handle('breast_size', e.target.value)}
                readOnly={isEditMode}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Butt Size</label>
              <input
                className={`w-full px-3 py-2 border rounded ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={form.butt_size}
                onChange={(e) => handle('butt_size', e.target.value)}
                readOnly={isEditMode}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Dick Size</label>
              <input
                className={`w-full px-3 py-2 border rounded ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={form.dick_size}
                onChange={(e) => handle('dick_size', e.target.value)}
                readOnly={isEditMode}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Personality</label>
              <input
                className={`w-full px-3 py-2 border rounded ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={form.personality}
                onChange={(e) => handle('personality', e.target.value)}
                readOnly={isEditMode}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Voice Type</label>
              <input
                className={`w-full px-3 py-2 border rounded ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={form.voice_type}
                onChange={(e) => handle('voice_type', e.target.value)}
                readOnly={isEditMode}
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Relationship Type</label>
              <input
                className={`w-full px-3 py-2 border rounded ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={form.relationship_type}
                onChange={(e) => handle('relationship_type', e.target.value)}
                readOnly={isEditMode}
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Clothing</label>
              <input
                className={`w-full px-3 py-2 border rounded ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={form.clothing}
                onChange={(e) => handle('clothing', e.target.value)}
                readOnly={isEditMode}
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Special Features</label>
              <input
                className={`w-full px-3 py-2 border rounded ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={form.special_features}
                onChange={(e) => handle('special_features', e.target.value)}
                readOnly={isEditMode}
              />
            </div>



            {!isEditMode && (
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Avatar (choose)</label>
                <div className="mt-2 grid grid-cols-6 gap-2 max-h-36 overflow-auto">
                  {characterAssets.slice(0, 60).map((a: any) => (
                    <button type="button" key={a} onClick={() => handle('avatar', a)} className={`w-full h-16 rounded overflow-hidden border ${form.avatar === a ? 'ring-2 ring-blue-500' : 'border-gray-200'}`}>
                      <img src={a} alt="avatar" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={async () => {
          if (!editCharacter) return;
          setActionLoading(true);
          try {
            await apiService.deleteCharacter(editCharacter.id);
            onSuccess?.();
            setConfirmDeleteOpen(false);
            onClose();
          } catch (err) {
            console.error('deleteCharacter', err);
          } finally { setActionLoading(false); }
        }}
        title="Delete Character"
        message={`Are you sure you want to delete ${editCharacter?.name || 'this character'}? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={actionLoading}
      />
    </>
  )
}
