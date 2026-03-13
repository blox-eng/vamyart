import * as React from 'react';
import classNames from 'classnames';

import { getComponent } from '../../components-registry';
import { mapStylesToClassNames as mapStyles } from '../../../utils/map-styles-to-class-names';
import SubmitButtonFormControl from './SubmitButtonFormControl';
import { trpc } from '../../../lib/trpc';

export default function FormBlock(props) {
    const formRef = React.createRef<HTMLFormElement>();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [submitStatus, setSubmitStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
    const { fields = [], elementId, submitButton, className, styles = {}, 'data-sb-field-path': fieldPath } = props;

    const createInquiry = trpc.inquiries.create.useMutation();

    // Pre-fill form fields from URL parameters
    React.useEffect(() => {
        if (typeof window !== 'undefined' && formRef.current) {
            const urlParams = new URLSearchParams(window.location.search);
            const pieceParam = urlParams.get('piece');
            if (pieceParam) {
                const pieceInput = formRef.current.querySelector<HTMLInputElement>('input[name="Piece"]');
                if (pieceInput) pieceInput.value = decodeURIComponent(pieceParam);
            }
        }
    }, [formRef]);

    if (fields.length === 0) return null;

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus('idle');

        const data = new FormData(formRef.current!);

        try {
            await createInquiry.mutateAsync({
                name: String(data.get('name') ?? ''),
                email: String(data.get('email') ?? ''),
                pieceInterest: String(data.get('Piece') ?? ''),
                message: String(data.get('message') ?? '') || undefined,
            });
            setSubmitStatus('success');
            formRef.current?.reset();
        } catch {
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
            data-sb-field-path={fieldPath}
        >
            {submitStatus === 'success' && (
                <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-md">
                    Thank you for your inquiry. We&apos;ll be in touch soon.
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
                {fields.map((field, index) => {
                    const modelName = field.__metadata.modelName;
                    if (!modelName) throw new Error(`form field does not have the 'modelName' property`);
                    const FormControl = getComponent(modelName);
                    if (!FormControl) throw new Error(`no component matching the form field model name: ${modelName}`);
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
