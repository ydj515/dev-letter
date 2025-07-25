import Image from 'next/image';
import { logos } from '@/constants';

const TechCarousel = () => {
  return (
    <div className="w-full overflow-hidden">
      <div className="flex animate-scroll">
        {[...logos, ...logos].map((logo, index) => (
          <div key={index} className="flex-shrink-0 mx-4">
            <Image src={logo.src} alt={logo.alt} width={64} height={64} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TechCarousel;
