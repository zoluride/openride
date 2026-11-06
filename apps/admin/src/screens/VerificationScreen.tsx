'use client';

import { useState } from 'react';

import { getSupabaseBrowser } from '@/lib/supabase-browser';

const REQUIRED_DOCUMENTS = [
  { type: 'license', label: 'License' },
  { type: 'lasdri', label: 'LASDRI' },
  { type: 'nhia', label: 'NHIA' },
] as const;

interface DriverRow {
  id: string;
  name: string | null;
  phone: string | null;
}

interface DocumentRow {
  id: string;
  driver_id: string;
  doc_type: string;
  status: string;
}

interface Props {
  drivers: DriverRow[];
  initialDocuments: DocumentRow[];
}

export function VerificationScreen({ drivers, initialDocuments }: Props) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verify(documentId: string): Promise<void> {
    setBusyId(documentId);
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!data.user) throw new Error('Sign in again to verify documents.');

      const { data: updatedDocument, error: updateError } = await supabase
        .from('driver_documents')
        .update({ status: 'approved', reviewer_id: data.user.id, review_notes: null })
        .eq('id', documentId)
        .select('id')
        .single();
      if (updateError) throw updateError;
      if (!updatedDocument) throw new Error('You are not allowed to verify this document.');

      setDocuments((current) =>
        current.map((document) =>
          document.id === documentId ? { ...document, status: 'approved' } : document,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">Driver verification</h2>
        <p className="text-sm text-gray-500">Review submitted License, LASDRI, and NHIA documents.</p>
      </div>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {drivers.length === 0 ? (
        <p className="text-sm text-gray-500">No drivers found.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Driver</th>
                <th className="px-3 py-2 font-medium">Document</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {drivers.flatMap((driver) =>
                REQUIRED_DOCUMENTS.map(({ type, label }) => {
                  const document = documents.find(
                    (item) => item.driver_id === driver.id && item.doc_type === type,
                  );
                  const verified = document?.status === 'approved';
                  const status = verified ? 'Verified' : document?.status === 'pending' ? 'Pending review' : document?.status ?? 'Not uploaded';
                  return (
                    <tr key={`${driver.id}-${type}`} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{driver.name ?? driver.id.slice(0, 8)}</div>
                        {driver.phone ? <div className="text-xs text-gray-500">{driver.phone}</div> : null}
                      </td>
                      <td className="px-3 py-2">{label}</td>
                      <td className={`px-3 py-2 ${verified ? 'font-medium text-green-700' : 'text-gray-600'}`}>
                        {status}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          disabled={!document || verified || busyId !== null}
                          onClick={() => document && void verify(document.id)}
                          className="rounded bg-green-700 px-3 py-1.5 text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busyId === document?.id ? 'Saving…' : verified ? 'Verified' : 'Verify'}
                        </button>
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
