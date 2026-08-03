// Server component shown instead of the whole app when NEXT_PUBLIC_SUPABASE_ANON_KEY /
// NEXT_PUBLIC_SUPABASE_ANON_KEY aren't set. Without them, createBrowserClient()
// throws immediately — better to explain what's missing than crash with a
// generic runtime error.
export function SupabaseSetupNotice() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#09090b] text-white">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-7">
        <h1 className="text-lg font-semibold mb-2">Supabase yapılandırması eksik</h1>
        <p className="text-sm text-white/70 mb-4">
          Bu uygulama Supabase üzerinden kimlik doğrulama ve veritabanı kullanıyor. Devam etmeden önce:
        </p>
        <ol className="text-sm text-white/70 space-y-2 list-decimal list-inside mb-4">
          <li>
            <a
              href="https://supabase.com"
              className="text-indigo-400 underline"
              target="_blank"
              rel="noreferrer"
            >
              supabase.com
            </a>{" "}
            üzerinde ücretsiz bir proje oluşturun.
          </li>
          <li>Proje panelinde SQL Editor → New query açın, <code>supabase/schema.sql</code> dosyasının içeriğini yapıştırıp çalıştırın.</li>
          <li>Project Settings → API sekmesinden Project URL, anon public key ve service_role key değerlerini kopyalayın.</li>
          <li>
            Proje klasöründeki <code>.env.local.example</code> dosyasını <code>.env.local</code> olarak kopyalayıp bu üç değeri girin. <code>SUPABASE_SERVICE_ROLE_KEY</code> artık zorunlu — giriş/oturum kontrolü veritabanına bu anahtarla sorgu atarak yapılıyor.
          </li>
          <li>Geliştirme sunucusunu yeniden başlatın (<code>npm run dev</code>).</li>
        </ol>
        <p className="text-xs text-white/40">
          Ayrıntılar için proje klasöründeki README.md dosyasına bakın.
        </p>
      </div>
    </div>
  );
}
