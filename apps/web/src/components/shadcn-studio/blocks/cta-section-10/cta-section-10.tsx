import { ArrowRightIcon } from '@/components/ui/icons'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type CTASectionProps = {
  heading: string
  description: string
  ctaLabel: string
  ctaHref: string
}

const CTASection = ({ heading, description, ctaLabel, ctaHref }: CTASectionProps) => {
  return (
    <section data-fdl='cta' className='bg-primary py-8 sm:py-16 lg:py-24'>
      <div className='mx-auto max-w-5xl px-4 sm:px-6 lg:px-8'>
        <Card className='bg-primary rounded-none border-0 shadow-none'>
          <CardContent
            className='flex justify-between gap-6 max-lg:flex-col md:px-8 lg:items-center'
            data-slot='cta-content'
          >
            <div className='space-y-4'>
              <h2 className='text-primary-foreground text-2xl font-semibold md:text-3xl lg:text-4xl'>{heading}</h2>
              <p className='text-muted-foreground text-lg md:text-xl'>{description}</p>
            </div>
            <div>
              <Button size='lg' variant='secondary' className='shrink-0 rounded-lg text-base has-[>svg]:px-6' asChild>
                <a href={ctaHref} className='inline-flex items-center gap-2'>
                  {ctaLabel}
                  <ArrowRightIcon className='size-5' />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

export default CTASection
