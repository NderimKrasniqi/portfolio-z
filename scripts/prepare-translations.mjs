import { readFileSync, writeFileSync } from "node:fs";
const source = JSON.parse(readFileSync("content/reference.json", "utf8")).en;
// Editorial drafts for review; importing never publishes or enables a locale.
const drafts = {
  fr: {
    nav: {
      home: "ACCUEIL",
      gallery: "GALERIE",
      about: "À PROPOS",
      shop: "BOUTIQUE",
      contact: "CONTACT",
    },
    aboutTitle: "MON HISTOIRE",
    description:
      "Zeudi Di Palma — sélection de projets, biographie et contact.",
    aboutLead:
      "J’ai grandi à Scampia, à Naples. Pour moi, ce quartier a toujours été chez moi, bien avant de devenir un lieu sur lequel les autres avaient un avis. Ma famille, mon quartier et les personnes qui m’entouraient ont façonné ma façon de voir le monde et font encore partie de tout ce que je fais.",
    shopTitle: "LE DRESSING DE ZEUDI.",
    shopIntro: "Des pièces de mon dressing et quelques éditions ponctuelles.",
    chapters: [
      [
        "MAISON",
        "C’est chez moi que j’ai appris tout ce que les gens peuvent porter les uns pour les autres.",
        "J’ai grandi auprès de ma mère, de mon frère Joe, de ma sœur Asia et de ma grand-mère. Mes souvenirs les plus forts sont ceux des femmes de ma famille et de leur façon de tout tenir ensemble. Mon père est parti quand j’avais deux ans. Ma mère a donc assumé l’essentiel des responsabilités, avec l’aide de ma grand-mère. Vers mes dix ans, ma grand-mère est morte et ma mère a perdu son travail. Je l’ai vue trouver de nouvelles façons de nous faire avancer, accepter les emplois qui se présentaient et nous permettre de continuer à regarder vers l’avenir. Une grande partie de ce que je suis vient de ces années : des personnes que j’aimais et que je voyais continuer, encore et encore.",
      ],
      [
        "INDÉPENDANCE",
        "Je voulais aider avant même qu’on me le demande.",
        "Ma mère ne m’a jamais demandé de porter ses responsabilités, mais la voir travailler aussi dur m’a donné envie de l’aider à ma manière. À douze ans, j’ai eu ma première expérience de mannequin avec Le Vele in Moda. Plus tard, tout en poursuivant mes études, j’ai travaillé comme ouvreuse au Teatro di San Carlo. Travailler jeune m’a apporté de l’indépendance et du recul. J’ai appris qu’il y a de la dignité dans chaque travail quand on sait pourquoi on le fait. Je suis aussi restée proche de La Lampada di Scampia, l’association créée par ma mère pour offrir des possibilités aux jeunes du quartier. J’ai choisi la sociologie pour mieux comprendre comment les personnes, les lieux et les opportunités se façonnent mutuellement. Je découvrais déjà que je n’avais pas à me limiter à une seule définition.",
      ],
      [
        "VISIBILITÉ",
        "Quand des portes ont commencé à s’ouvrir, je voulais que Scampia m’accompagne.",
        "Miss Italia a changé l’échelle de ma vie. J’y suis arrivée comme Miss Napoli et, en 2022, je suis devenue Miss Italia 2021. Soudain, il y avait une couronne, un titre et un public beaucoup plus large. J’étais reconnaissante, mais j’ai aussi compris à quelle vitesse la visibilité peut réduire une personne à une image. Je voulais montrer davantage et parler de Scampia telle que je la connaissais : un quartier complexe, mais aussi plein de familles, de talents et de jeunes qui travaillent pour construire un autre avenir. La beauté m’a peut-être ouvert cette porte, mais je n’ai jamais voulu qu’elle soit la seule raison de ma présence.",
      ],
      [
        "SINCÉRITÉ",
        "Être vue est une chose. Se laisser voir avec sincérité en est une autre.",
        "Grande Fratello m’a exposée à une autre forme de lumière. Il n’y avait ni photographie parfaite ni instant soigneusement choisi derrière lequel me cacher. Les gens ont vu mes émotions, mes contradictions, mon humour, ma sensibilité et des aspects de mon identité que j’avais mis des années à comprendre et à accepter. Ce n’était pas toujours facile, mais cela a changé mon regard sur la visibilité. J’ai cessé de croire qu’être forte signifiait avoir toutes les réponses. Parfois, c’est accepter de changer en public, reconnaître ses doutes et choisir l’honnêteté, même lorsqu’il serait plus simple de devenir la personne que les autres attendent.",
      ],
      [
        "ZEUDINERS",
        "Certains liens continuent après l’arrêt des caméras.",
        "Pendant Grande Fratello, des personnes de pays, de langues et de vies différents se sont rencontrées à travers mon parcours. Ce soutien est devenu les Zeudiners, une communauté restée présente après les caméras. Ce qui me touche le plus, c’est ce que ces personnes ont fait de ce lien : elles se sont réunies, ont soutenu des causes et transformé leur affection en aide pour les autres. Ces gestes leur appartiennent, à celles et ceux qui ont donné, organisé et pris soin des autres. Je suis simplement reconnaissante que mon histoire leur ait permis de se trouver. Aujourd’hui, Twitch et le direct nous offrent un espace plus spontané et quotidien. Nous parlons, rions, cuisinons ou passons une soirée ordinaire ensemble. Notre relation a évolué avec ma vie. Les caméras ont changé, mais je les sens toujours à mes côtés lorsque je grandis et essaie de nouvelles choses. Les Zeudiners n’ont jamais été seulement un public : des personnes venues suivre mon histoire ont choisi de rester pour la suite.",
      ],
      [
        "DEVENIR",
        "Je ne veux pas que mon histoire s’arrête au moment où les gens ont appris mon nom.",
        "Scampia, le travail, l’université, Miss Italia, la télévision, le streaming, le tatouage et les rencontres m’ont chacun révélé une partie de moi-même. Je veux continuer à construire avec intention. Je souhaite aborder le métier d’actrice sérieusement : étudier, m’entraîner et mériter une nouvelle opportunité. L’attention peut disparaître aussi vite qu’elle arrive. Ce qui reste, c’est la personne que l’on devient et le travail accompli quand personne ne regarde. Je garde en moi la petite fille qui regardait sa mère recommencer, le quartier qui m’a appris à ne pas accepter les limites des autres et l’envie d’avancer sans toujours avoir de carte. Je ne sais pas exactement à quoi ressemblera le prochain chapitre, et cela me plaît. Je veux garder la liberté de changer, la curiosité de recommencer et l’honnêteté de rester moi-même.",
      ],
    ],
  },
  es: {
    nav: {
      home: "INICIO",
      gallery: "GALERÍA",
      about: "SOBRE MÍ",
      shop: "TIENDA",
      contact: "CONTACTO",
    },
    aboutTitle: "MI HISTORIA",
    description:
      "Zeudi Di Palma — selección de trabajos, biografía y contacto.",
    aboutLead:
      "Crecí en Scampia, en Nápoles. Para mí, siempre fue mi hogar antes de ser un lugar sobre el que los demás tenían opiniones. Mi familia, mi barrio y las personas que me rodeaban moldearon mi forma de ver el mundo y siguen siendo parte de todo lo que hago.",
    shopTitle: "EL ARMARIO DE ZEUDI.",
    shopIntro: "Prendas de mi armario y algunas ediciones ocasionales.",
    chapters: [
      [
        "HOGAR",
        "En casa aprendí cuánto podemos sostenernos unos a otros.",
        "Crecí con mi madre, mi hermano Joe, mi hermana Asia y mi abuela cerca. Mis recuerdos más fuertes son los de las mujeres de mi familia y su manera de mantenerlo todo unido. Mi padre se fue cuando tenía dos años y mi madre asumió casi toda la responsabilidad, con la ayuda de mi abuela. Cuando tenía unos diez años, mi abuela murió y mi madre perdió su trabajo. La vi buscar nuevas formas de salir adelante, aceptar los trabajos que encontraba y permitirnos seguir mirando al futuro. Mucho de lo que soy viene de aquellos años: de ver a las personas que quería continuar una y otra vez.",
      ],
      [
        "INDEPENDENCIA",
        "Quería ayudar antes de que nadie me lo pidiera.",
        "Mi madre nunca me pidió que cargara con sus responsabilidades, pero verla trabajar tanto me hizo querer ayudar a mi manera. A los doce años tuve mi primera experiencia como modelo con Le Vele in Moda. Más tarde, mientras seguía estudiando, trabajé como acomodadora en el Teatro di San Carlo. Trabajar joven me dio independencia y perspectiva. Aprendí que cualquier trabajo tiene dignidad cuando sabes por qué lo haces. También seguí cerca de La Lampada di Scampia, la asociación que fundó mi madre para crear oportunidades para los jóvenes del barrio. Elegí Sociología para comprender cómo las personas, los lugares y las oportunidades se influyen mutuamente. Ya estaba aprendiendo que no tenía que encajar en una sola definición.",
      ],
      [
        "VISIBILIDAD",
        "Cuando empezaron a abrirse puertas, quería que Scampia viniera conmigo.",
        "Miss Italia cambió la escala de mi vida. Llegué como Miss Napoli y en 2022 me convertí en Miss Italia 2021. De pronto había una corona, un título y un público mucho más amplio. Agradecía la oportunidad, pero entendí lo rápido que la visibilidad puede reducir a alguien a una imagen. Quería que la gente viera más y hablar de la Scampia que yo conocía: compleja, sí, pero también llena de familias, talento y jóvenes que trabajan por un futuro diferente. Puede que la belleza me abriera esa puerta, pero nunca quise que fuera la única razón para seguir allí.",
      ],
      [
        "SINCERIDAD",
        "Que te vean es una cosa. Dejar que te vean de verdad es otra.",
        "Grande Fratello me llevó a otro tipo de exposición. No había una fotografía perfecta ni un momento cuidadosamente elegido detrás del que esconderme. La gente vio mis emociones, mis contradicciones, mi humor, mi sensibilidad y aspectos de mi identidad que había tardado años en comprender y aceptar. No siempre fue fácil, pero cambió mi forma de pensar sobre ser vista. Dejé de creer que ser fuerte significaba tener todas las respuestas. A veces significa permitirte cambiar en público, reconocer tus dudas y elegir la honestidad, aunque fuera más fácil convertirte en la persona que los demás esperan.",
      ],
      [
        "ZEUDINERS",
        "Algunos vínculos no terminan cuando se apagan las cámaras.",
        "Durante Grande Fratello, personas de distintos países, idiomas y vidas comenzaron a encontrarse a través de mi recorrido. Ese apoyo se convirtió en los Zeudiners, una comunidad que permaneció después de las cámaras. Lo que más me emociona es lo que hicieron con ese vínculo: se unieron, apoyaron causas y transformaron el cariño en ayuda para otros. Esos gestos pertenecen a quienes dieron, organizaron y cuidaron. Solo agradezco que algo de mi historia les ayudara a encontrarse. Hoy Twitch y los directos nos dan un lugar más espontáneo y cotidiano. Hablamos, reímos, cocinamos o compartimos una tarde normal. Nuestra relación cambió junto con mi vida. Las cámaras son distintas, pero los sigo sintiendo a mi lado mientras crezco y pruebo cosas nuevas. Los Zeudiners nunca fueron solo una audiencia: quienes empezaron viendo mi historia eligieron quedarse para lo que vino después.",
      ],
      [
        "CRECER",
        "No quiero que mi historia termine cuando la gente aprendió mi nombre.",
        "Scampia, el trabajo, la universidad, Miss Italia, la televisión, el streaming, el tatuaje y las personas que he conocido me han dado nuevas partes de mí misma. Quiero seguir construyendo con intención. Quiero tomarme la interpretación en serio: estudiar, entrenar y ganarme la siguiente oportunidad. La atención puede desaparecer tan rápido como llega. Lo que queda es la persona en la que te conviertes y el trabajo que haces cuando nadie mira. Sigo llevando conmigo a la niña que veía a su madre empezar de nuevo, el barrio que me enseñó a no aceptar los límites ajenos y el impulso de avanzar sin tener siempre un mapa. No sé exactamente cómo será el próximo capítulo y me gusta. Quiero conservar la libertad de cambiar, la curiosidad de empezar otra vez y la honestidad de seguir siendo yo.",
      ],
    ],
  },
};
const out = {};
for (const [locale, draft] of Object.entries(drafts)) {
  out[locale] = {
    ...structuredClone(source),
    ...draft,
    chapters: draft.chapters.map(([label, title, body], i) => ({
      id: `chapter-${i + 1}`,
      label,
      title,
      body,
    })),
    products: [],
  };
}
writeFileSync(
  "content/translation-drafts.json",
  JSON.stringify(out, null, 2) + "\n",
);
console.log(
  "Prepared French and Spanish editorial drafts; demo product translations still require review.",
);
