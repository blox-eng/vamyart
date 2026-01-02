import * as React from 'react';
import classNames from 'classnames';

import { getComponent } from '../../components-registry';
import { mapStylesToClassNames as mapStyles } from '../../../utils/map-styles-to-class-names';
import SubmitButtonFormControl from './SubmitButtonFormControl';

export default function FormBlock(props) {
    const formRef = React.createRef<HTMLFormElement>();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [submitStatus, setSubmitStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
    const { fields = [], elementId, submitButton, className, styles = {}, 'data-sb-field-path': fieldPath } = props;

    if (fields.length === 0) {
        return null;
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus('idle');

        const data = new FormData(formRef.current);

        try {
            const response = await fetch('/__forms.html', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(data as any).toString()
            });

            if (response.ok) {
                setSubmitStatus('success');
                formRef.current?.reset();
            } else {
                setSubmitStatus('error');
            }
        } catch (error) {
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <form
            className={classNames(
                'sb-component',
                'sb-component-block',
                'sb-component-form-block',
                className,
                styles?.self?.margin ? mapStyles({ margin: styles?.self?.margin }) : undefined,
                styles?.self?.padding ? mapStyles({ padding: styles?.self?.padding }) : undefined,
                styles?.self?.borderWidth && styles?.self?.borderWidth !== 0 && styles?.self?.borderStyle !== 'none'
                    ? mapStyles({
                          borderWidth: styles?.self?.borderWidth,
                          borderStyle: styles?.self?.borderStyle,
                          borderColor: styles?.self?.borderColor ?? 'border-primary'
                      })
                    : undefined,
                styles?.self?.borderRadius ? mapStyles({ borderRadius: styles?.self?.borderRadius }) : undefined
            )}
            name={elementId}
            id={elementId}
            onSubmit={handleSubmit}
            ref={formRef}
            data-netlify="true"
            data-netlify-honeypot="bot-field"
            data-sb-field-path={fieldPath}
        >
            {/* Honeypot field for spam protection - hidden from users */}
            <p className="hidden">
                <label>
                    Don&apos;t fill this out if you&apos;re human: <input name="bot-field" />
                </label>
            </p>

            {submitStatus === 'success' && (
                <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-md">
                    Thank you for your submission! We&apos;ll get back to you soon.
                </div>
            )}

            {submitStatus === 'error' && (
                <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-md">
                    Something went wrong. Please try again.
                </div>
            )}

            <div
                className={classNames('w-full', 'flex', 'flex-wrap', 'gap-8', mapStyles({ justifyContent: styles?.self?.justifyContent ?? 'flex-start' }))}
                {...(fieldPath && { 'data-sb-field-path': '.fields' })}
            >
                <input type="hidden" name="form-name" value={elementId} />
                {fields.map((field, index) => {
                    const modelName = field.__metadata.modelName;
                    if (!modelName) {
                        throw new Error(`form field does not have the 'modelName' property`);
                    }
                    const FormControl = getComponent(modelName);
                    if (!FormControl) {
                        throw new Error(`no component matching the form field model name: ${modelName}`);
                    }
                    return <FormControl key={index} {...field} {...(fieldPath && { 'data-sb-field-path': `.${index}` })} />;
                })}
            </div>
            {submitButton && (
                <div className={classNames('mt-8', 'flex', mapStyles({ justifyContent: styles?.self?.justifyContent ?? 'flex-start' }))}>
                    <SubmitButtonFormControl {...submitButton} disabled={isSubmitting} {...(fieldPath && { 'data-sb-field-path': '.submitButton' })} />
                </div>
            )}
        </form>
    );
}
