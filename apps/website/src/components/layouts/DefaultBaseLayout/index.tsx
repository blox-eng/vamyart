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
            <div className="sb-base sb-default-base-layout min-h-screen flex flex-col">
                {site.header && <Header {...site.header} enableAnnotations={enableAnnotations} />}
                <div className="flex-1">{props.children}</div>
                {site.footer && <Footer {...site.footer} enableAnnotations={enableAnnotations} />}
            </div>
        </div>
    );
}
