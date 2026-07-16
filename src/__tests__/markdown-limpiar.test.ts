import { describe, it, expect } from 'vitest'
import { limpiarMarkdown } from '@/lib/markdown'

describe('limpiarMarkdown — texto plano para la nota clínica', () => {
  it('quita títulos # ## ###', () => {
    expect(limpiarMarkdown('# Diagnóstico')).toBe('Diagnóstico')
    expect(limpiarMarkdown('### Plan')).toBe('Plan')
  })

  it('quita negritas ** y __', () => {
    expect(limpiarMarkdown('El paciente **niega** fiebre')).toBe('El paciente niega fiebre')
    expect(limpiarMarkdown('__importante__')).toBe('importante')
  })

  it('quita itálicas simples * y _ dejando el contenido', () => {
    expect(limpiarMarkdown('dolor *intenso* referido')).toBe('dolor intenso referido')
  })

  it('convierte viñetas - y * a •', () => {
    expect(limpiarMarkdown('- uno\n- dos')).toBe('• uno\n• dos')
    expect(limpiarMarkdown('* alfa\n* beta')).toBe('• alfa\n• beta')
  })

  it('quita código en backticks', () => {
    expect(limpiarMarkdown('dosis `500 mg`')).toBe('dosis 500 mg')
  })

  it('reduce enlaces [texto](url) a solo el texto', () => {
    expect(limpiarMarkdown('ver [guía IDSA](https://ejemplo.org/x)')).toBe('ver guía IDSA')
  })

  it('colapsa 3+ saltos de línea a doble y recorta extremos', () => {
    expect(limpiarMarkdown('a\n\n\n\nb')).toBe('a\n\nb')
    expect(limpiarMarkdown('   texto   ')).toBe('texto')
  })

  it('caso realista de salida de IA queda como prosa limpia', () => {
    const md = '## Impresión\n\nPaciente con **neumonía** adquirida en comunidad.\n\n- Iniciar *ceftriaxona*\n- Ver `hemocultivos`\n'
    const out = limpiarMarkdown(md)
    expect(out).not.toMatch(/[#*`]/)      // sin símbolos markdown
    expect(out).toContain('Impresión')
    expect(out).toContain('neumonía')
    expect(out).toContain('• Iniciar ceftriaxona')
    expect(out).toContain('• Ver hemocultivos')
  })

  it('no deja asteriscos sueltos con negrita + itálica adyacentes', () => {
    const out = limpiarMarkdown('**bold** y *italic*')
    expect(out).toBe('bold y italic')
    expect(out).not.toContain('*')
  })
})
