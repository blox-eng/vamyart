import * as React from 'react';
import classNames from 'classnames';
import Header from '../../sections/Header';
import Footer from '../../sections/Footer';

export default function DefaultBaseLayout(props) {
    const { page, site } = props;
    const { enableAnnotations = true } = site;
    const pageMeta = page?.__metadata || {};

    return (
        <div className={classNames('sb-page', pageMeta.pageCssClasses)} {...(enableAnnotations && { 'data-sb-object-id': pageMeta.id })}>
            <div className={classNames('sb-base sb-default-base-layout flex flex-col', !page?.slimHeader && 'min-h-screen')}>
                {site.header && <Header {...site.header} slim={page?.slimHeader} enableAnnotations={enableAnnotations} />}
                <div className="flex-1">{props.children}</div>
                {site.footer && !page?.hideFooter && <Footer {...site.footer} enableAnnotations={enableAnnotations} />}
            </div>
        </div>
    );
}
