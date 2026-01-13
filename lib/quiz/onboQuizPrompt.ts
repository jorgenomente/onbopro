export const ONBO_QUIZ_V1_PROMPT = `Necesito que generes N preguntas de opcion multiple en formato ONBO-QUIZ v1.

Reglas:
- Usa exactamente 4 opciones por pregunta (A1..A4).
- CORRECT debe ser 1, 2, 3 o 4 (una sola correcta).
- EXPLAIN es opcional pero recomendado (1-2 lineas).
- No agregues texto fuera del formato.
- No numeres las preguntas fuera del bloque.

Contenido fuente:
[PEGAR AQUI EL TEXTO / LECCION / PROCEDIMIENTO]

Formato obligatorio (repetir por pregunta):
---
Q: [pregunta]
A1: [opcion]
A2: [opcion]
A3: [opcion]
A4: [opcion]
CORRECT: [1|2|3|4]
EXPLAIN: [opcional]
---
`;
