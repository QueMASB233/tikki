export default function TerminosPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-16 text-slate-700">
      <h1 className="text-3xl font-semibold text-brand-dark">
        Términos y condiciones
      </h1>
      <p className="text-sm leading-relaxed">
        Estos términos describen las condiciones de uso del servicio Estudia
        Seguro. Al suscribirte aceptas que la asesoría proviene de un modelo de
        lenguaje que utiliza la información proporcionada por ti para responder
        con fines educativos. Consulta el README para detalles sobre soporte y
        cumplimiento.
      </p>
      <p className="text-sm leading-relaxed">
        El servicio se factura mensualmente mediante Stripe. Puedes cancelar en
        cualquier momento. No compartas tu cuenta con terceros. Para dudas,
        contáctanos en soporte@estudiaseguro.com.
      </p>
    </div>
  );
}




