import interestCategories from "./interest-categories.json";

interface TechLogo {
  src: string;
  alt: string;
}

export const INTEREST_CATEGORIES = interestCategories;

export const logos: TechLogo[] = [
  { src: "/tech-icons/java.svg", alt: "Java" },
  { src: "/tech-icons/kotlin.svg", alt: "Kotlin" },
  { src: "/tech-icons/go.svg", alt: "Go" },
  { src: "/tech-icons/python.svg", alt: "Python" },
  { src: "/tech-icons/typescript.svg", alt: "Typescript" },
  { src: "/tech-icons/spring.svg", alt: "Spring" },
  { src: "/tech-icons/react.svg", alt: "React" },
  { src: "/tech-icons/nextjs.svg", alt: "NextJS" },
  { src: "/tech-icons/mysql.svg", alt: "Mysql" },
  { src: "/tech-icons/postgresql.svg", alt: "PostgreSQL" },
  { src: "/tech-icons/redis.svg", alt: "Redis" },
  { src: "/tech-icons/elasticsearch.svg", alt: "Elasticsearch" },
  { src: "/tech-icons/mongodb.svg", alt: "MongoDB" },
  { src: "/tech-icons/prometheus.svg", alt: "Prometheus" },
  { src: "/tech-icons/docker.svg", alt: "Docker" },
  { src: "/tech-icons/kubernetes.svg", alt: "Kubernetes" },
];

export const techBlogs = [
  { name: "우아한형제들", url: "https://techblog.woowahan.com/" },
  { name: "쿠팡", url: "https://medium.com/coupang-engineering/kr/home" },
  { name: "당근마켓", url: "https://medium.com/daangn" },
  { name: "토스", url: "https://toss.tech/" },
  { name: "카카오", url: "https://tech.kakao.com/" },
];
