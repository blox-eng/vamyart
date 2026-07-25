import * as React from 'react';
import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

import Section from '../Section';
import Badge from '../../atoms/Badge';
import TitleBlock from '../../blocks/TitleBlock';

export default function CollectionsCarouselSection(props) {
    const { elementId, colors, backgroundImage, badge, title, subtitle, collections = [], styles = {} } = props;

    // Injected empty (or spliced out) when there are no published collections;
    // guard anyway so the component is safe to render in isolation.
    if (!collections.length) return null;

    return (
        <Section
            elementId={elementId}
            className="sb-component-collections-carousel-section"
            colors={colors}
            backgroundImage={backgroundImage}
            styles={styles?.self}
        >
            <div className="w-full flex flex-col items-center">
                {badge?.label && <Badge {...badge} className="w-full max-w-sectionBody" />}
                {title?.text && <TitleBlock {...title} className="w-full max-w-sectionBody mt-4" />}
                {subtitle && <p className="w-full max-w-sectionBody text-lg sm:text-2xl mt-4">{subtitle}</p>}

                <div className="w-full mt-12">
                    <Swiper
                        modules={[Autoplay, Pagination]}
                        slidesPerView={1}
                        spaceBetween={24}
                        loop={collections.length > 1}
                        autoplay={{ delay: 4500, disableOnInteraction: false }}
                        pagination={{ clickable: true }}
                        breakpoints={{
                            768: { slidesPerView: collections.length > 1 ? 2 : 1 },
                            1280: { slidesPerView: Math.min(collections.length, 3) }
                        }}
                    >
                        {collections.map((c) => (
                            <SwiperSlide key={c.slug}>
                                <Link href={`/gallery/collections/${c.slug}`} className="group block pb-10">
                                    <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: '3 / 2' }}>
                                        {c.coverUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={c.coverUrl}
                                                alt={c.title}
                                                loading="lazy"
                                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 bg-neutral-200" />
                                        )}
                                    </div>
                                    <div className="mt-3">
                                        <p className="text-lg">{c.title}</p>
                                        <p className="text-sm opacity-70">
                                            {c.pieceCount} piece{c.pieceCount === 1 ? '' : 's'}
                                        </p>
                                    </div>
                                </Link>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>
            </div>
        </Section>
    );
}
