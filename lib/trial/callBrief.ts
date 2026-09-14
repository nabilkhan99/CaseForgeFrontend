/**
 * The initials the guest screens show for a patient: the orb on the call
 * screen and the tile on the reading page. The same two letters the signed-in
 * session screen derives from `patient_name`.
 */
export function patientInitials(patientName: string | null | undefined): string {
  const parts = (patientName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  return parts
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
