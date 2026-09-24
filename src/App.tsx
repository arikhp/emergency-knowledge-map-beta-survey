import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import logo from './assets/logo.png';
import './App.css';
import { meta, openQuestions, statements, tasks } from './data/questionnaire';
import type { FormValues } from './types';
import { ParticipantSection } from './components/ParticipantSection';
import { TaskCard } from './components/TaskCard';
import { StatementsSection } from './components/StatementsSection';
import { OpenQuestionsSection } from './components/OpenQuestionsSection';
import { SummarySection } from './components/SummarySection';
import { ReviewView } from './ReviewView';
import { flattenForm } from './lib/flatten';
import { submitResponse } from './lib/submitResponse';
import { exportElementToPdf, elementToPdfBase64 } from './lib/exportPdf';

const today = new Date().toISOString().slice(0, 10);

// Set at build time in vite.config.ts; each deploy rebuilds, so it's the last deploy time.
const LAST_UPDATED = new Date(import.meta.env.VITE_BUILD_TIME as string).toLocaleString('he-IL', {
  timeZone: 'Asia/Jerusalem',
  dateStyle: 'short',
  timeStyle: 'short',
});

const defaultValues: FormValues = {
  participantName: '',
  participantRole: '',
  participantDate: today,
  background: [],
  frequency: '',
  tasks: Object.fromEntries(tasks.map((t) => [t.id, { ease: '', completion: '', notes: '' }])),
  statements: Object.fromEntries(statements.map((s) => [s.id, ''])),
  nps: '',
  open: Object.fromEntries(openQuestions.map((q) => [q.id, ''])),
  summaryScore: '',
  followUp: '',
};

type SubmitState = 'idle' | 'submitting' | 'done' | 'error-no-endpoint' | 'error-network';

function pdfFilename(participantName: string): string {
  const name = (participantName || 'משתתף').trim();
  return `שאלון-בטא-${name}-${today}.pdf`;
}

function App() {
  const {
    register,
    handleSubmit,
    getValues,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues });

  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [pdfBusy, setPdfBusy] = useState(false);
  const reviewRef = useRef<HTMLDivElement>(null);

  // Subscribing via watch() keeps the off-screen review view in sync with
  // every keystroke, so whatever is on screen at export time is what gets
  // captured into the PDF.
  const liveValues = watch();

  const onSubmit = async (values: FormValues) => {
    setSubmitState('submitting');
    const flat = flattenForm(values);

    // Build the same PDF the manual export button produces, and send it
    // along so the backend saves a copy to Drive — no download dialog here,
    // this happens silently as part of submission.
    let pdf: { base64: string; filename: string } | undefined;
    if (reviewRef.current) {
      try {
        const base64 = await elementToPdfBase64(reviewRef.current);
        pdf = { base64, filename: pdfFilename(values.participantName) };
      } catch {
        // If PDF generation fails, still submit the form data — don't block on it.
      }
    }

    const result = await submitResponse(flat, pdf);
    if (result.skipped) {
      setSubmitState('error-no-endpoint');
    } else if (result.ok) {
      setSubmitState('done');
    } else {
      setSubmitState('error-network');
    }
  };

  const handleExportPdf = async () => {
    if (!reviewRef.current) return;
    setPdfBusy(true);
    try {
      const name = getValues('participantName');
      await exportElementToPdf(reviewRef.current, pdfFilename(name));
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="review-offscreen" aria-hidden="true">
        <ReviewView ref={reviewRef} values={liveValues} />
      </div>

      <header className="hero">
        <div className="hero-inner">
          <img src={logo} alt="לוגו מפת הידע לחירום" className="hero-logo" />
          <div>
            <p className="hero-kicker">{meta.kicker}</p>
            <h1>{meta.title}</h1>
            <h2>{meta.subtitle}</h2>
          </div>
        </div>
      </header>

      <nav className="section-nav">
        <a href="#participant">פרטי המשתתף/ת</a>
        <a href="#partA">חלק א&apos;</a>
        <a href="#partB">חלק ב&apos;</a>
        <a href="#partC">חלק ג&apos;</a>
        <a href="#summary">סיכום</a>
        <button
          type="button"
          className="btn btn-outline nav-export"
          onClick={handleExportPdf}
          disabled={pdfBusy}
        >
          {pdfBusy ? 'מייצא...' : 'ייצוא ל-PDF'}
        </button>
      </nav>

      <main className="content">
        {submitState === 'done' ? (
          <section className="card success-card">
            <h2>תודה רבה!</h2>
            <p>{meta.thankYou}</p>
            <p>התשובות נשלחו ונשמרו בהצלחה.</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExportPdf}
              disabled={pdfBusy}
            >
              {pdfBusy ? 'מייצא...' : 'הורדת עותק PDF של התשובות'}
            </button>
          </section>
        ) : (
          <>
            <section className="card intro-card">
              <h2 className="section-title">{meta.instructionsTitle}</h2>
              <p>{meta.intro}</p>
              <p className="intro-subtitle">{meta.workMethodTitle}</p>
              <ul>
                {meta.workMethod.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <p>{meta.duration}</p>
              <p>{meta.confidentiality}</p>
            </section>

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <ParticipantSection register={register} errors={errors} />

              <section id="partA">
                <h2 className="section-title part-heading">חלק א&apos; — משימות מודרכות</h2>
                <p className="section-hint">
                  בצעו את המשימות הבאות בתוך המערכת, לפי הסדר. לאחר כל משימה סמנו את מידת הקלות
                  ורשמו הערות.
                </p>
                {tasks.map((task, i) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={i}
                    register={register}
                    errors={errors}
                  />
                ))}
              </section>

              <StatementsSection register={register} errors={errors} />
              <OpenQuestionsSection register={register} />
              <SummarySection
                register={register}
                errors={errors}
                submitting={submitState === 'submitting'}
              />

              {submitState === 'error-no-endpoint' && (
                <p className="banner banner-warning">
                  לא הוגדר יעד לשמירת תשובות (Google Sheet). התשובות לא נשמרו מרחוק — מומלץ
                  לייצא עותק PDF ולשלוח אותו ידנית.
                </p>
              )}
              {submitState === 'error-network' && (
                <p className="banner banner-warning">
                  אירעה שגיאה בשליחת התשובות. אנא ייצאו עותק PDF ושלחו אותו ידנית, ונסו שוב
                  מאוחר יותר.
                </p>
              )}
            </form>
          </>
        )}
      </main>

      <footer className="page-footer">
        <p>{meta.thankYou}</p>
        <p className="last-updated">עודכן לאחרונה: {LAST_UPDATED}</p>
      </footer>
    </div>
  );
}

export default App;
