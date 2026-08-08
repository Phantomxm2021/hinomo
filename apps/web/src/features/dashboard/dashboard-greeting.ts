export type GreetingKey = 'morning' | 'noon' | 'afternoon' | 'evening'

export function greetingForHour(hour: number): GreetingKey {
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 14) return 'noon'
  if (hour >= 14 && hour < 18) return 'afternoon'
  return 'evening'
}
