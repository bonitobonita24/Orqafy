'use client'

import { useState } from 'react'

import { EyeIcon, EyeOffIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'

const LoginForm = () => {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <form className='space-y-4' onSubmit={e => e.preventDefault()}>
      <FieldGroup className='gap-4'>
        {/* Email */}
        <Field className='gap-1'>
          <FieldLabel htmlFor='userEmail' className='leading-5'>
            Email address*
          </FieldLabel>
          <Input type='email' id='userEmail' placeholder='Enter your email address' />
        </Field>
        {/* Password */}
        <Field className='gap-1'>
          <FieldLabel htmlFor='password' className='leading-5'>
            Password*
          </FieldLabel>
          <InputGroup>
            <InputGroupInput id='password' type={isVisible ? 'text' : 'password'} placeholder='••••••••••••••••' />
            <InputGroupAddon align='inline-end' className='pr-1.5'>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => setIsVisible(prevState => !prevState)}
                className='text-muted-foreground rounded-l-none hover:bg-transparent'
              >
                {isVisible ? <EyeOffIcon /> : <EyeIcon />}
                <span className='sr-only'>{isVisible ? 'Hide password' : 'Show password'}</span>
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </Field>

        {/* Remember Me and Forgot Password */}
        <div className='flex items-center justify-between gap-y-2'>
          <Field orientation='horizontal' className='flex items-center gap-3'>
            <Checkbox id='rememberMe' className='size-6' />
            <FieldLabel htmlFor='rememberMe' className='text-muted-foreground'>
              Remember Me
            </FieldLabel>
          </Field>

          <a href='#' className='text-nowrap hover:underline'>
            Forgot Password?
          </a>
        </div>

        <Field>
          <Button className='w-full' type='submit'>
            Sign in to Shadcn Studio
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}

export default LoginForm
