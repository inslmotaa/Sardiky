'use client'

import { useId, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { fmt, FOOD_GROUPS, searchFoods } from '@/lib/nutricao'

export type PickerFood = { id: string; name: string; group: string; per100: { kcal: number } }

export type FoodPickerHandle = { focus: () => void }

/**
 * Busca de alimentos tolerante a acentos e erros ("pao frances" → Pão francês),
 * com navegação por teclado (↑ ↓ Enter Esc).
 */
export const FoodPicker = forwardRef<
  FoodPickerHandle,
  {
    foods: PickerFood[]
    onPick: (food: PickerFood) => void
    onFreeText?: (text: string) => void
    placeholder?: string
    label?: string
  }
>(function FoodPicker({ foods, onPick, onFreeText, placeholder = 'Buscar alimento…', label = 'Adicionar alimento' }, ref) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }))
  const results = useMemo(() => (q.trim() ? searchFoods(foods, q, 10) : []), [foods, q])
  const free = onFreeText && q.trim().length > 1
  const total = results.length + (free ? 1 : 0)

  const choose = (i: number) => {
    if (i < results.length) onPick(results[i])
    else if (free) onFreeText!(q.trim())
    setQ('')
    setOpen(false)
    setActive(0)
  }

  return (
    <div className="food-picker">
      <input
        ref={input}
        type="search"
        value={q}
        placeholder={placeholder}
        aria-label={label}
        role="combobox"
        aria-expanded={open && total > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(total - 1, a + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(0, a - 1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (total > 0) choose(active)
          } else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && total > 0 && (
        <ul className="food-picker__list" role="listbox" id={listId}>
          {results.map((f, i) => (
            <li key={f.id} role="option" aria-selected={i === active} onMouseDown={(e) => (e.preventDefault(), choose(i))}>
              <span>{f.name}</span>
              <small>
                {FOOD_GROUPS[f.group] ?? f.group} · {fmt(f.per100.kcal, 0)} kcal/100 g
              </small>
            </li>
          ))}
          {free && (
            <li role="option" aria-selected={active === results.length} onMouseDown={(e) => (e.preventDefault(), choose(results.length))}>
              <span>Adicionar “{q.trim()}” como texto livre</span>
              <small>sem cálculo</small>
            </li>
          )}
        </ul>
      )}
    </div>
  )
})
