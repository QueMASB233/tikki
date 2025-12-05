export default function PrivacidadPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-16 text-slate-700">
      <h1 className="text-3xl font-semibold text-brand-dark">
        Aviso de privacidad
      </h1>
      <p className="text-sm leading-relaxed">
        Estudia Seguro almacena tu correo, historial de chat y datos de pago de
        forma segura mediante Supabase y Stripe. Usamos tu información para
        personalizar la asesoría académica y mejorar el servicio.
      </p>
      <p className="text-sm leading-relaxed">
        Puedes solicitar la eliminación de tus datos enviando un correo a
        privacidad@estudiaseguro.com. El borrado se procesará en máximo 7 días
        hábiles.
      </p>
    </div>
  );
}




