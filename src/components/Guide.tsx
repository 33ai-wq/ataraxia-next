'use client'

export function Guide() {
  const guides = [
    {
      title: 'Breathing Guide',
      icon: '🫁',
      steps: [
        'Klik "Mulai Breathing" di Dashboard',
        'Ikuti lingkaran: Taruh (4s) → Tahan (4s) → Hembuskan (6s) → Istirahat (2s)',
        'Setiap siklus penuh = +10 XP',
        'Breathing teratur membuka achievement: First Breath (1), Steady Rhythm (10), Deep Diver (50)',
      ],
    },
    {
      title: 'Ambient Soundscape',
      icon: '🎵',
      steps: [
        'Klik ikon suara untuk mainkan/hentikan',
        'Geser slider volume yang muncul saat aktif',
        'Maksimal suara bersamaan meningkat seiring level (mulai 1)',
        'Kombinasi suara berbeda = Sound Weaver achievement',
      ],
    },
    {
      title: 'Zen Garden',
      icon: '🏜️',
      steps: [
        'Klik/tarik di kanvas untuk menuangkan pasir',
        'Pasir jatuh & menumpuk di bawah',
        'Setiap sesi lepaskan = +5-15 butir pasir',
        '50 butir = +2 XP, 1000 butir = Zen Artist achievement',
        'Tombol "Kosongkan Taman" = reset + bonus 50 butir',
      ],
    },
    {
      title: 'Journey & Levels',
      icon: '🗺️',
      steps: [
        'Lihat progress di bagian Journey (Dashboard)',
        '6 Level: Seed → Sprout → Still Grove → Mirror Lake → Silent Mountain → Boundless Ocean',
        'XP dari: Breathing, Zen Garden, streak harian, intentions',
        'Streak 2 hari = Returning Soul achievement',
      ],
    },
    {
      title: 'Profile & Hedera',
      icon: '👤',
      steps: [
        'Upload avatar (max 2MB) & simpan nama di Profile',
        'HBAR balance testnet ditampilkan otomatis (read-only)',
        'Account ID: 0.0.4865075 | EVM: 0x510b8dae...',
        'Data progress tersimpan di localStorage (per device)',
      ],
    },
    {
      title: 'Rewards (Coming Soon)',
      icon: '🎁',
      steps: [
        'XP bisa diklaim jadi HBAR/HTS token via manual drip',
        'Rate: 1000 XP = $0.10 equivalent',
        'Cap $1/hari, queue off-chain, Merkle weekly',
        'Treasury dikelola manual oleh Boss',
      ],
    },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-light text-sand-900 mb-6">Guide</h2>
      <p className="text-sand-600 mb-8">
        Selamat datang di Ataraxia — sanctuary pribadi untuk ketenangan. 
        Tidak ada grind, tidak ada tekanan. Hanya napas, suara, dan pasir.
      </p>

      <div className="space-y-6">
        {guides.map((guide, i) => (
          <div key={i} className="card p-6">
            <div className="flex items-start gap-4">
              <span className="text-3xl mt-1">{guide.icon}</span>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-sand-900 mb-3">{guide.title}</h3>
                <ol className="space-y-2 text-sm text-sand-600">
                  {guide.steps.map((step, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="text-primary-500 font-mono text-xs mt-0.5">
                        {j + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 card p-6 bg-primary-50 border-primary-100">
        <h3 className="font-medium text-primary-900 mb-2">Tips</h3>
        <ul className="text-sm text-primary-700 space-y-1 list-disc list-inside">
          <li>Buka tiap hari untuk streak bonus</li>
          <li>Kombinasikan breathing + ambient sound untuk fokus</li>
          <li>Zen garden cocok untuk istirahat mata dari layar</li>
          <li>Semua data lokal — tidak ada server, tidak ada tracking</li>
        </ul>
      </div>
    </div>
  )
}