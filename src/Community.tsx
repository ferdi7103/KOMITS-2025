import React, { useEffect, useState } from 'react';
import snapshot from './community-data.json';

export const communityMenu = [
  ['home', 'Beranda'], ['about', 'Tentang'], ['donate', 'Donasi'],
  ['reports', 'Laporan'], ['market', 'Marketplace'], ['jobs', 'Lowongan Freelance'],
  ['beneficiaries', 'Penerima'], ['shop', 'Toko & Preorder'],
] as const;
export type CommunityPage = typeof communityMenu[number][0];
export function readPage(): CommunityPage {
  const hash = window.location.hash.slice(1);
  return communityMenu.some(([id]) => id === hash) ? hash as CommunityPage : 'home';
}
const origin = 'https://komits2025.org';
const money = (value: string | number) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(Number(value));
const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('-') : value;
// Content is rendered as text, including the source's simple <strong> markup.
const plain = (value: string) => value.replace(/<[^>]*>/g, '');
const sourceUrl = (value: string) => {
  try { const url = new URL(value, origin); return url.protocol === 'https:' ? url.href : undefined; }
  catch { return undefined; }
};
const wa = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;
const card = 'rounded-3xl border border-gray-100 bg-white p-6 shadow-sm';
const link = 'inline-flex rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700';
type Data = typeof snapshot;
type Endpoint = Exclude<keyof Data, 'retrievedAt'>;
const endpoints: Partial<Record<CommunityPage, Endpoint[]>> = {
  home: ['donation-summary', 'jobs', 'marketplace'], about: ['about'],
  reports: ['donation-reports'], market: ['marketplace'], jobs: ['jobs'], beneficiaries: ['beneficiaries'],
};

export default function Community({ page }: { page: CommunityPage }) {
  const [data, setData] = useState<Data>(snapshot);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setSearch('');
    const keys = endpoints[page] || [];
    setStatus(keys.length ? 'Memperbarui data dari komits2025.org…' : '');
    Promise.all(keys.map(async key => {
      const response = await fetch(`/api/community/${key}`, { signal: controller.signal });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Unavailable');
      const value = await response.json();
      if (Array.isArray(snapshot[key]) ? !Array.isArray(value) : !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid data');
      return [key, value] as const;
    })).then(entries => {
      if (controller.signal.aborted) return;
      setData(previous => ({ ...previous, ...Object.fromEntries(entries) }));
      setStatus(keys.length ? 'Data diperbarui dari komits2025.org.' : '');
    }).catch(() => {
      if (!controller.signal.aborted) setStatus(`Sumber belum dapat dihubungi. Menampilkan salinan data yang diambil ${date(snapshot.retrievedAt)}.`);
    });
    return () => controller.abort();
  }, [page]);
  const about = data.about;
  const summary = data['donation-summary'];
  const title = communityMenu.find(([id]) => id === page)?.[1];
  const query = search.trim().toLowerCase();
  return <div className="space-y-6 pb-8">
    <div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">Kepedulian OTM ITS</p>
      <h2 className="mt-2 text-3xl font-bold">{title}</h2></div>
    {status && <p role="status" className="text-sm text-gray-500">{status}</p>}
    {page === 'home' && <>
      <section className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-800 p-7 text-white sm:p-10">
        <h3 className="max-w-xl text-3xl font-extrabold leading-tight sm:text-4xl">Transparansi • Kepedulian • Kesempatan</h3>
        <p className="my-5 max-w-xl leading-relaxed text-blue-100">Pusat informasi komunitas OTM ITS 2025: laporan keuangan, mini marketplace, lowongan kerja part-time, dan penerima bantuan.</p>
        <a href="#donate" className="inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-blue-700">Ikut Berdonasi</a>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        {([['Donasi Terkumpul', money(summary.collectedDonation)], ['Donasi Tersalurkan', money(summary.distributedDonation)], ['Penerima Aktif', summary.activeBeneficiaries], ['Total Penerima', summary.totalBeneficiaries]]).map(([label, value]) =>
          <div key={label} className={card}><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}
      </div>
      <p className="text-sm text-gray-500">Pembaruan ringkasan donasi: {date(summary.lastUpdated)}</p>
      <div className="grid gap-4 sm:grid-cols-2">{communityMenu.filter(([id]) => id !== 'home').map(([id, label]) =>
        <a key={id} href={`#${id}`} className={`${card} hover:border-blue-300`}><h3 className="font-bold text-blue-700">{label} →</h3></a>)}
      </div>
    </>}
    {page === 'about' && <>
      <section className={`${card} space-y-5`}>
        <h3 className="text-xl font-bold">Latar Belakang</h3><p className="whitespace-pre-line leading-relaxed">{plain(about.about)}</p>
        <h3 className="text-xl font-bold">Visi</h3><p>{plain(about.vision)}</p>
        <h3 className="text-xl font-bold">Misi</h3><p className="whitespace-pre-line leading-relaxed">{plain(about.mission)}</p>
      </section>
      <h3 className="text-xl font-bold">Struktur Organisasi</h3>
      <div className="grid gap-4 sm:grid-cols-2">{about.org.map(member => <div key={member.role} className={card}>
        <p className="text-sm text-gray-500">{member.role}</p><p className="mt-2 whitespace-pre-line font-semibold">{member.name}</p>
      </div>)}</div>
      <div className="flex flex-wrap gap-3"><a className={link} href={sourceUrl(about.contact.whatsapp)} target="_blank" rel="noreferrer">WhatsApp</a>
        <a className={link} href={sourceUrl(about.contact.instagram)} target="_blank" rel="noreferrer">Instagram</a>
        <a className={link} href={`mailto:${about.contact.email}`}>Email</a></div>
    </>}
    {page === 'donate' && <section className={`${card} space-y-5`}>
      <h3 className="text-xl font-bold">Informasi Rekening Donasi</h3>
      <div className="rounded-2xl bg-blue-50 p-6 text-blue-800"><p>Bank BNI</p><p className="mt-3 font-semibold">Meiria Susilawati</p><p className="mt-2 break-all text-3xl font-bold tracking-wider">1992455826</p></div>
      <p>Terima kasih atas kepedulian Anda. Semua donasi akan digunakan untuk kegiatan sosial KOMITS 2025 dan akan dilaporkan secara transparan.</p>
      <a className={link} href="#reports">Lihat Laporan Donasi</a>
      <p className="text-sm text-gray-500">Informasi rekening disalin dari halaman Donasi komits2025.org pada {date(snapshot.retrievedAt)}. <a className="underline" href={`${origin}/#donate`} target="_blank" rel="noreferrer">Lihat sumber</a></p>
    </section>}
    {page === 'reports' && <>
      <p className="text-gray-600">Laporan pemasukan dan pengeluaran KOMITS 2025 (PDF).</p>
      {[...data['donation-reports']].sort((a,b) => b.date.localeCompare(a.date)).map(report => <article className={card} key={report.id}>
        <p className="text-sm text-gray-500">{date(report.date)}</p><h3 className="my-2 text-xl font-bold">{report.title}</h3>
        <p className="mb-4 whitespace-pre-line">{report.description}</p><a className={link} href={sourceUrl(report.downloadUrl)} target="_blank" rel="noreferrer">Buka Laporan PDF</a>
      </article>)}
      {!data['donation-reports'].length && <p className={card}>Belum ada laporan donasi.</p>}
    </>}
    {(page === 'market' || page === 'jobs') && <label className="block text-sm font-semibold">{page === 'market' ? 'Cari usaha atau kategori' : 'Cari lowongan atau lokasi'}
      <input value={search} onChange={event => setSearch(event.target.value)} type="search" className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3" placeholder="Ketik pencarian…" /></label>}
    {page === 'market' && <div className="grid gap-5 sm:grid-cols-2">
      {data.marketplace.filter(item => `${item.title} ${item.categories} ${item.note}`.toLowerCase().includes(query)).map(item => <article key={item.id} className={`${card} space-y-3`}>
        {item.images?.map(image => <img key={image} loading="lazy" src={sourceUrl(image.startsWith('https:') ? image : `/images/${image}`)} alt={`${item.title} — foto usaha`} className="max-h-64 w-full rounded-xl bg-gray-50 object-contain" />)}
        <p className="text-xs font-bold text-blue-600">{item.categories.replace(/#/g, ' • ')}</p><h3 className="text-xl font-bold">{item.title}</h3><p className="whitespace-pre-line text-sm">{item.note}</p>
        {item.video && <video className="w-full rounded-xl" src={sourceUrl(item.video)} controls preload="none" aria-label={`Video ${item.title}`} />}
        {item.whatsapp && <a className={link} href={wa(item.whatsapp)} target="_blank" rel="noreferrer">Hubungi Penjual</a>}
      </article>)}
      {!data.marketplace.some(item => `${item.title} ${item.categories} ${item.note}`.toLowerCase().includes(query)) && <p>Tidak ada usaha yang cocok.</p>}
    </div>}
    {page === 'jobs' && <div className="space-y-4">
      {data.jobs.filter(job => job.active && `${job.role} ${job.org} ${job.location}`.toLowerCase().includes(query)).map(job => <article className={`${card} space-y-3`} key={job.id}>
        <p className="text-sm text-blue-600">{job.org} • {job.location}</p><h3 className="text-xl font-bold">{job.role}</h3><p className="whitespace-pre-line text-sm">{job.minReq}</p>
        <p className="text-sm">Honor: {job.salary} • Dipasang: {date(job.postingDate)}</p>
        {job.contact && <a className={link} href={wa(job.contact)} target="_blank" rel="noreferrer">Hubungi Pemberi Lowongan</a>}
      </article>)}
      {!data.jobs.some(job => job.active && `${job.role} ${job.org} ${job.location}`.toLowerCase().includes(query)) && <p className={card}>Tidak ada lowongan aktif yang cocok.</p>}
    </div>}
    {page === 'beneficiaries' && <>
      <p className="text-gray-600">Daftar penerima bantuan yang dipublikasikan oleh KOMITS 2025.</p>
      <div className="space-y-4">{data.beneficiaries.map(item => <article className={`${card} space-y-2`} key={item.id}>
        <h3 className="text-xl font-bold">{item.name}</h3><p>{item.type} • {date(item.date)}</p><p>{item.note}</p>{item.amount && <p>{money(item.amount)}</p>}
      </article>)}{!data.beneficiaries.length && <p className={card}>Belum ada penerima bantuan.</p>}</div>
    </>}
    <footer className="border-t border-gray-200 pt-6 text-sm text-gray-500">Sumber informasi: <a href={origin} className="text-blue-600 underline" target="_blank" rel="noreferrer">komits2025.org</a> • KOMITS 2025</footer>
  </div>;
}
