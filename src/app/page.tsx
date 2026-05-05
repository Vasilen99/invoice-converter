import React from 'react';
import { Sparkles, FileText, Wand2, Download } from 'lucide-react';
import { InvoiceUploader } from '../components';

const steps = [
	{ icon: FileText, label: 'Качване', desc: 'Пуснете вашата Stripe фактура (PDF)' },
	{ icon: Wand2, label: 'Извличане', desc: 'AI чете всяко поле мигновено' },
	{ icon: Sparkles, label: 'Генериране', desc: 'Българска фактура е създадена' },
	{ icon: Download, label: 'Изтегляне', desc: 'Експортирайте като перфектен PDF' },
];

const HomePage = () => {
	return (
		<main className="relative min-h-screen overflow-x-hidden bg-[#0a0a1a]">
			{/* ── Animated gradient background ── */}
			<div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
				<div className="animate-float absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-indigo-600/20 blur-[120px]" />
				<div className="animate-float2 absolute top-1/3 -right-32 w-[500px] h-[500px] rounded-full bg-purple-600/20 blur-[100px]" />
				<div className="animate-float absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-pink-600/15 blur-[90px]" />
				{/* Grid overlay */}
				<div
					className="absolute inset-0 opacity-[0.04]"
					style={{
						backgroundImage:
							'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)',
						backgroundSize: '48px 48px',
					}}
				/>
			</div>

			<div className="relative z-10 max-w-7xl mx-auto px-4 py-16">
				{/* ── Hero ── */}
				<div className="text-center mb-16 animate-fade-up">
					{/* Badge */}
					<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-6 text-indigo-300 text-xs font-semibold tracking-widest uppercase">
						<Sparkles className="w-3.5 h-3.5 animate-pulse" />
						Конвертор на фактури с изкуствен интелект
					</div>

					<h1 className="text-5xl sm:text-6xl font-black tracking-tight text-white leading-tight mb-4">
						Stripe →{' '}
						<span className="gradient-text">Българска</span>
						<br />
						Фактура за секунди
					</h1>
					<p className="text-lg text-white/50 max-w-xl mx-auto leading-relaxed">
						Качете произволна Stripe фактура и нашият AI мигновено извлича всяко поле,
						след което генерира напълно съответстваща българска фактура, готова за изтегляне.
					</p>
				</div>

				{/* ── Steps ── */}
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-14 animate-fade-up delay-200">
					{steps.map((s, i) => (
						<div
							key={i}
							className="glass rounded-2xl p-5 flex flex-col items-center text-center gap-2 group hover:bg-white/10 transition-colors"
						>
							<div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-1 group-hover:bg-indigo-500/30 transition-colors">
								<s.icon className="w-5 h-5 text-indigo-300" />
							</div>
							<div className="text-xs font-bold text-white/80 uppercase tracking-wider">
								{s.label}
							</div>
							<div className="text-xs text-white/40">{s.desc}</div>
						</div>
					))}
				</div>

				{/* ── Main card ── */}
				<div className="glass-white rounded-3xl shadow-2xl shadow-indigo-900/30 p-8 animate-scale-in delay-300">
					<InvoiceUploader />
				</div>

				{/* ── Footer ── */}
				<p className="text-center text-white/20 text-xs mt-10">
					Задвижено от GPT-4o · Създадено за УЕБ СЪРВИСИС БЪЛГАРИЯ ЕООД
				</p>
			</div>
		</main>
	);
};

export default HomePage;
