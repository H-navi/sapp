import { describe, it, expect } from 'vitest'

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function generateIndonesianCsv(headers: string[], rows: any[][]): string {
  const BOM = '\uFEFF'
  const headerLine = headers.map(escapeCsvCell).join(';')
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(';')).join('\r\n')
  return BOM + headerLine + '\r\n' + dataLines
}

describe('CSV Export Formatting (Task 11)', () => {
  it('menghasilkan berkas dengan UTF-8 BOM pada karakter pertama', () => {
    const csv = generateIndonesianCsv(['No', 'Nama'], [['1', 'Ahmad Ridwan']])
    expect(csv.startsWith('\uFEFF')).toBe(true)
  })

  it('menggunakan pemisah titik koma (;) standar Excel Indonesia', () => {
    const headers = ['Nomor Pengajuan', 'Nama Pegawai', 'Jenis Izin', 'Total Hari']
    const rows = [
      ['REQ-001', 'Budi Santoso', 'Cuti Tahunan', 3],
      ['REQ-002', 'Siti Rahma', 'Cuti Melahirkan', 90],
    ]
    const csv = generateIndonesianCsv(headers, rows)

    const lines = csv.replace('\uFEFF', '').split('\r\n')
    expect(lines[0]).toBe('Nomor Pengajuan;Nama Pegawai;Jenis Izin;Total Hari')
    expect(lines[1]).toBe('REQ-001;Budi Santoso;Cuti Tahunan;3')
    expect(lines[2]).toBe('REQ-002;Siti Rahma;Cuti Melahirkan;90')
  })

  it('meng-escape sel yang mengandung tanda petik ganda, titik koma, dan baris baru', () => {
    const headers = ['Nomor', 'Alasan']
    const rows = [
      ['REQ-101', 'Izin keluarga; perlu menghadiri acara di "Bandung"'],
      ['REQ-102', 'Baris satu\nBaris dua'],
    ]
    const csv = generateIndonesianCsv(headers, rows)

    expect(csv).toContain('"Izin keluarga; perlu menghadiri acara di ""Bandung"""')
    expect(csv).toContain('"Baris satu\nBaris dua"')
  })
})
