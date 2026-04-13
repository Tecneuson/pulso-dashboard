# Pulso — Design System

O design system do Pulso é derivado da identidade visual do Hospital Santa Mônica, adaptado para um contexto de dashboard operacional. O objetivo é transmitir **confiança, clareza e eficiência** — o mesmo cuidado que o hospital tem com seus pacientes, refletido na interface que gerencia o atendimento.

---

## Filosofia de design

O HSM é um hospital psiquiátrico com 55+ anos de história, certificação ONA 3 Ouro e 83 mil m² cercados por mata atlântica. O visual do site institucional usa tons de verde escuro (natureza/saúde) com branco limpo. O Pulso herda essa essência mas a traduz para um dashboard operacional: menos institucional, mais funcional.

**Princípios:**
1. **Dados primeiro** — informação é o protagonista, decoração é ruído
2. **Hierarquia clara** — o olho sabe pra onde ir sem pensar
3. **Calma operacional** — tons neutros como base, cor só pra comunicar estado
4. **Densidade calibrada** — denso onde precisa (Kanban), respira onde precisa (métricas)
5. **Dark mode como padrão** — operadores olham a tela o dia todo

---

## Paleta de cores

### Base (superfícies e texto)

```css
:root {
  /* Light mode */
  --bg-primary: #FAFAF8;        /* fundo principal — off-white quente */
  --bg-secondary: #F2F1ED;      /* cards e surfaces */
  --bg-tertiary: #E8E7E3;       /* inputs, hover states */
  --bg-elevated: #FFFFFF;        /* modals, dropdowns */

  --text-primary: #1A1A18;      /* títulos e texto principal */
  --text-secondary: #5C5C58;    /* texto secundário */
  --text-tertiary: #8A8A84;     /* placeholders, hints */
  --text-inverse: #FAFAF8;      /* texto sobre fundos escuros */

  --border-default: rgba(26, 26, 24, 0.08);
  --border-hover: rgba(26, 26, 24, 0.16);
  --border-active: rgba(26, 26, 24, 0.24);
}

[data-theme="dark"] {
  --bg-primary: #0C0C0B;        /* fundo principal */
  --bg-secondary: #161615;      /* cards e surfaces */
  --bg-tertiary: #1E1E1C;       /* inputs, hover states */
  --bg-elevated: #222220;       /* modals, dropdowns */

  --text-primary: #ECECEA;      /* títulos e texto principal */
  --text-secondary: #9C9C96;    /* texto secundário */
  --text-tertiary: #6A6A64;     /* placeholders, hints */
  --text-inverse: #0C0C0B;      /* texto sobre fundos claros */

  --border-default: rgba(236, 236, 234, 0.06);
  --border-hover: rgba(236, 236, 234, 0.12);
  --border-active: rgba(236, 236, 234, 0.20);
}
```

### Marca (derivada do HSM)

```css
:root {
  /* Verde HSM — cor institucional */
  --brand-50: #E6F5ED;
  --brand-100: #C0E6D1;
  --brand-200: #96D4B2;
  --brand-300: #6CC293;
  --brand-400: #4DB57C;
  --brand-500: #2EA866;          /* verde principal do HSM */
  --brand-600: #28965A;
  --brand-700: #1F7A49;
  --brand-800: #175E38;
  --brand-900: #0E3F25;
}
```

### Semânticas (estados do sistema)

```css
:root {
  /* Sucesso — internação confirmada, autorizado */
  --success-50: #ECFDF3;
  --success-500: #12B76A;
  --success-700: #027A48;

  /* Warning — atenção, tempo alto */
  --warning-50: #FFFAEB;
  --warning-500: #F79009;
  --warning-700: #B54708;

  /* Danger — urgente, recusou, perda */
  --danger-50: #FEF3F2;
  --danger-500: #F04438;
  --danger-700: #B42318;

  /* Info — consultando, em processo */
  --info-50: #EFF8FF;
  --info-500: #2E90FA;
  --info-700: #175CD3;

  /* Neutro — novo contato */
  --neutral-50: #F5F5F4;
  --neutral-500: #78786E;
  --neutral-700: #44443E;
}
```

### Cores do Kanban (cada coluna tem uma cor sutil)

```css
:root {
  --stage-novo: var(--neutral-500);
  --stage-atendendo: var(--info-500);
  --stage-consultando: var(--warning-500);
  --stage-autorizado: var(--brand-500);
  --stage-a-caminho: var(--info-500);
  --stage-recepcao: var(--brand-400);
  --stage-recusou: var(--danger-500);
  --stage-confirmado: var(--success-500);
}
```

---

## Tipografia

```css
/* Display — títulos grandes, KPIs */
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');

/* Body — texto corrido, labels */
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');

/* Mono — números, dados, métricas */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');

:root {
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

### Escala tipográfica

| Token | Tamanho | Peso | Line height | Uso |
|-------|---------|------|-------------|-----|
| `display-xl` | 36px | 700 | 1.1 | KPI principal, número hero |
| `display-lg` | 28px | 600 | 1.2 | Títulos de seção |
| `display-md` | 22px | 600 | 1.25 | Subtítulos, títulos de card |
| `heading` | 18px | 500 | 1.3 | Títulos menores |
| `body-lg` | 16px | 400 | 1.5 | Texto principal |
| `body` | 14px | 400 | 1.5 | Texto padrão da UI |
| `body-sm` | 13px | 400 | 1.45 | Labels, captions |
| `caption` | 12px | 400 | 1.4 | Hints, timestamps |
| `mono-lg` | 28px | 600 | 1.2 | Números de KPI |
| `mono` | 14px | 400 | 1.5 | Dados numéricos em tabelas |
| `mono-sm` | 12px | 400 | 1.4 | IDs, códigos |

**Regras:**
- `--font-display` para tudo ≥ 22px
- `--font-body` para tudo < 22px (texto corrido, labels)
- `--font-mono` para qualquer número que o usuário vai comparar (métricas, tempos, contadores)
- Números de KPI sempre em `--font-mono` com `font-variant-numeric: tabular-nums`

---

## Tailwind Config

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50: '#E6F5ED',
          100: '#C0E6D1',
          200: '#96D4B2',
          300: '#6CC293',
          400: '#4DB57C',
          500: '#2EA866',
          600: '#28965A',
          700: '#1F7A49',
          800: '#175E38',
          900: '#0E3F25',
        },
        surface: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          elevated: 'var(--bg-elevated)',
        },
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        'card': '0 1px 2px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.06)',
        'elevated': '0 8px 24px rgba(0, 0, 0, 0.08)',
        'modal': '0 16px 48px rgba(0, 0, 0, 0.12)',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) both',
        'fade-in': 'fadeIn 0.3s ease both',
        'slide-in': 'slideIn 0.3s cubic-bezier(0.25, 0.1, 0.25, 1) both',
        'count-up': 'countUp 0.6s cubic-bezier(0.25, 0.1, 0.25, 1) both',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
```

---

## Espaçamento

Base: 4px. Todos os espaçamentos são múltiplos de 4.

| Token | Valor | Uso |
|-------|-------|-----|
| `space-1` | 4px | Micro gap (ícone-texto) |
| `space-2` | 8px | Padding interno mínimo |
| `space-3` | 12px | Gap entre elementos relacionados |
| `space-4` | 16px | Padding de cards, gap de listas |
| `space-5` | 20px | Padding de seções |
| `space-6` | 24px | Gap entre seções |
| `space-8` | 32px | Margem entre blocos |
| `space-10` | 40px | Margem de página |
| `space-12` | 48px | Espaçamento hero |

---

## Componentes

### Card

```
┌─────────────────────────┐
│  padding: 16px           │
│  bg: --bg-secondary      │
│  border: 1px solid       │
│     --border-default     │
│  border-radius: 12px     │
│  shadow: shadow-card     │
│                          │
│  hover:                  │
│    border: --border-hover│
│    shadow: shadow-card-  │
│            hover         │
│    transform: tY(-1px)   │
└─────────────────────────┘
```

### KPI Card

```
┌─────────────────────────┐
│  [label]     body-sm     │
│  [valor]     mono-lg 600 │
│  [delta]     mono-sm     │
│              ↑ verde     │
│              ↓ vermelho  │
│              — neutro    │
└─────────────────────────┘
```

O valor numérico usa `--font-mono` com animação de contagem (count-up).

### Kanban Card

```
┌─────────────────────────┐
│ ● badge-tipo   ⏱ 2h 34m │  <- badge colorido + tempo no estágio
│                          │
│ Nome do Paciente         │  <- heading, 500
│ Bradesco Saúde           │  <- body-sm, text-secondary
│                          │
│ 🏷️ Urgente               │  <- tag vermelha se urgente
│ @agente                  │  <- caption, text-tertiary
└─────────────────────────┘
Largura: fixa 280px
Drag handle: toda a superfície
```

### Badge / Tag

```
Variantes:
  default:  bg-tertiary,     text-secondary
  success:  success-50,      success-700
  warning:  warning-50,      warning-700
  danger:   danger-50,       danger-700
  info:     info-50,         info-700
  brand:    brand-50,        brand-700

  padding: 2px 8px
  border-radius: 6px
  font: body-sm, 500
```

### Button

```
Variantes:
  primary:    bg brand-500, text white, hover brand-600
  secondary:  bg bg-tertiary, text text-primary, hover border-hover
  ghost:      bg transparent, text text-secondary, hover bg-tertiary
  danger:     bg danger-500, text white, hover danger-700

  Tamanhos:
  sm: h-32px, px-12, body-sm
  md: h-40px, px-16, body
  lg: h-48px, px-20, body-lg

  border-radius: 8px
  transition: all 150ms ease
```

### Sidebar (navegação)

```
Largura: 240px (expandida) / 64px (colapsada)
Background: --bg-secondary
Border-right: 1px solid --border-default

Itens:
  padding: 8px 12px
  border-radius: 8px
  font: body, 400
  color: --text-secondary

  active:
    bg: --bg-tertiary
    color: --text-primary
    font-weight: 500
    border-left: 2px solid brand-500

  hover:
    bg: --bg-tertiary
```

---

## Gráficos (Recharts)

Paleta de dados para gráficos:

```typescript
export const chartColors = {
  primary: '#2EA866',     // brand-500
  secondary: '#2E90FA',   // info-500
  tertiary: '#F79009',    // warning-500
  quaternary: '#7F77DD',  // purple
  quinary: '#5DCAA5',     // teal

  // Para gráficos de status
  success: '#12B76A',
  warning: '#F79009',
  danger: '#F04438',
  neutral: '#78786E',
}

// Configuração base do Recharts
export const chartConfig = {
  grid: {
    stroke: 'var(--border-default)',
    strokeDasharray: '4 4',
  },
  axis: {
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    fill: 'var(--text-tertiary)',
  },
  tooltip: {
    background: 'var(--bg-elevated)',
    border: 'var(--border-default)',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'var(--font-body)',
  },
}
```

---

## Ícones

Lucide React — consistente, leve, funciona com Tailwind.

```typescript
import {
  LayoutDashboard,   // Dashboard
  Columns3,          // Kanban
  Users,             // Contatos
  MessageSquare,     // Conversas
  BarChart3,         // Relatórios
  Settings,          // Configurações
  Search,            // Busca
  Filter,            // Filtros
  ChevronDown,       // Dropdowns
  MoreHorizontal,    // Menu de ações
  Clock,             // Tempo no estágio
  AlertTriangle,     // Urgente
  CheckCircle2,      // Sucesso
  XCircle,           // Recusou
  ArrowRight,        // Navegação
  ExternalLink,      // Link pro Chatwoot
} from 'lucide-react'
```

Tamanho padrão: 16px na sidebar e inline, 20px em headers, 24px em estados vazios.

---

## Motion

Todas as animações respeitam `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Padrões:**
- Page transitions: `fadeUp`, 400ms, stagger 60ms entre elementos
- Cards: `fadeUp`, 300ms, stagger 40ms
- Modals: `fadeIn` backdrop 200ms + `slideIn` conteúdo 300ms
- KPI numbers: count-up 600ms com easing
- Drag-and-drop: spring physics, 200ms settle
- Hover states: 150ms ease, translateY(-1px) + shadow lift

---

## Breakpoints

```css
sm:  640px   /* mobile landscape */
md:  768px   /* tablet */
lg:  1024px  /* desktop pequeno — sidebar colapsa */
xl:  1280px  /* desktop — layout completo */
2xl: 1536px  /* wide — mais colunas no Kanban */
```

**Kanban responsivo:**
- `< md`: scroll horizontal, 1 coluna visível por vez
- `md - lg`: 3 colunas visíveis, scroll horizontal
- `lg - xl`: 5 colunas visíveis
- `> xl`: todas as 8 colunas visíveis

---

## Estados

### Loading
- Skeleton com pulse animation (nunca spinner sozinho)
- KPIs: skeleton retangular na área do número
- Kanban: 3 skeleton cards por coluna

### Empty
- Ilustração simples em SVG (monocromática)
- Texto: heading + body explicativo
- CTA quando aplicável

### Error
- Borda danger ao redor do componente afetado
- Mensagem inline, não toast (para erros de dados)
- Toast apenas para ações do usuário (salvou, moveu, etc.)
