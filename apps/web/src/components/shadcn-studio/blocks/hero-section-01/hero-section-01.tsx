import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const HeroSection = () => {
  return (
    <section className='flex flex-1 flex-col justify-center gap-12 overflow-x-hidden py-20 sm:py-28 lg:py-36'>
      {/* Hero Content */}
      <div className='mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 text-center sm:px-6 lg:px-8'>
        <div className='bg-muted flex items-center gap-2.5 rounded-full border px-2 py-1 text-sm'>
          <Badge variant='outline'>Multi-tenant</Badge>
          <span className='text-muted-foreground'>Operations platform for growing businesses</span>
        </div>

        <h1 className='text-3xl leading-[1.29167] font-bold text-balance sm:text-4xl lg:text-5xl'>
          Run your entire business
          <br />
          from{' '}
          <span className='relative text-primary'>
            one platform
            <svg
              width='223'
              height='12'
              viewBox='0 0 223 12'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
              className='absolute inset-x-0 bottom-0 w-full translate-y-1/2 max-sm:hidden'
              aria-hidden='true'
            >
              <path
                d='M1.11716 10.428C39.7835 4.97282 75.9074 2.70494 114.894 1.98894C143.706 1.45983 175.684 0.313587 204.212 3.31596C209.925 3.60546 215.144 4.59884 221.535 5.74551'
                stroke='url(#paint0_linear_10365_68643)'
                strokeWidth='2'
                strokeLinecap='round'
              />
              <defs>
                <linearGradient
                  id='paint0_linear_10365_68643'
                  x1='18.8541'
                  y1='3.72033'
                  x2='42.6487'
                  y2='66.6308'
                  gradientUnits='userSpaceOnUse'
                >
                  <stop stopColor='var(--primary)' />
                  <stop offset='1' stopColor='var(--primary-foreground)' />
                </linearGradient>
              </defs>
            </svg>
          </span>
        </h1>

        <p className='text-muted-foreground max-w-2xl'>
          Field operations, HR, inventory, invoicing, and payroll — unified under one workspace. Built for teams
          that operate in the real world.
        </p>

        <div className='flex flex-col items-center gap-3 sm:flex-row'>
          <Button size='lg' asChild>
            <a href='/register'>Start free trial</a>
          </Button>
          <Button size='lg' variant='outline' asChild>
            <a href='/demo-login'>Explore demo</a>
          </Button>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
