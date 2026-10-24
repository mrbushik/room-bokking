export function App() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-20">
      <header className="border-b border-stone-200 pb-8">
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-stone-500 uppercase">
          Переговорная
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Бронирование комнаты
        </h1>
        <p className="mt-3 max-w-xl leading-7 text-stone-600">
          Рабочий день — с 09:00 до 18:00.
        </p>
      </header>
      <section
        aria-labelledby="schedule-heading"
        className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8"
      >
        <h2 id="schedule-heading" className="text-lg font-medium text-stone-900">
          Расписание на день
        </h2>
        <p className="mt-2 leading-7 text-stone-500">
          Расписание и форма бронирования пока не подключены.
        </p>
      </section>
    </main>
  )
}
