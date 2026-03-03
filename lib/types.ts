export interface Experiment {
  id: string
  page: string
  location: string
  hypothesis: string
  variant_description: string
  primary_metric: string
  guardrail_metric: string
  effort: 'Low' | 'Medium' | 'High'
  priority: number
  injection_code: string
  scroll_to_selector?: string
  status: 'pending' | 'approved' | 'rejected'
  screenshots?: {
    control: string // base64 jpeg
    variant: string // base64 jpeg
  }
}
