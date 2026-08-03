import * as path from "path";
import { Stack, StackProps, RemovalPolicy, CfnOutput, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { EnvConfig, APP_NAME } from "./config";

export interface MarketingStackProps extends StackProps {
  readonly cfg: EnvConfig;
  /** Custom domains (aliases) for CloudFront, e.g. apex + www. Optional. */
  readonly domainNames?: string[];
  /**
   * ARN of an ACM certificate in us-east-1 covering `domainNames`. Required
   * when `domainNames` is set (CloudFront only accepts us-east-1 certs).
   */
  readonly certificateArn?: string;
}

/**
 * Static marketing site — the public-facing "Trump Account Gift Cards" landing
 * site (built from `marketing/`, a Vite/React SPA).
 *
 * Architecture:
 *   S3 (private) ── OAC ──▶ CloudFront ──▶ viewers (HTTPS)
 *
 * The bucket is fully private; only CloudFront can read it via an Origin Access
 * Control (OAC) signed request. Because the site is a client-routed SPA
 * (wouter: /, /shop, /faq, …), 403/404 from S3 are rewritten to /index.html so
 * deep links resolve. Assets are uploaded and the distribution invalidated on
 * every deploy.
 *
 * For this first pass the site is served on the auto-generated
 * *.cloudfront.net domain; a custom domain + ACM cert can be layered on later.
 */
export class MarketingStack extends Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: MarketingStackProps) {
    super(scope, id, props);
    const { cfg } = props;

    // Private origin bucket — no public access, CloudFront-only reads via OAC.
    this.bucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: `${APP_NAME}-${cfg.stage}-marketing`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // Dev is disposable; prod retains the bucket on stack deletion.
      removalPolicy: cfg.isEphemeral ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      autoDeleteObjects: cfg.isEphemeral,
    });

    // Custom domain + cert are opt-in via props (populated from env in app.ts):
    // absent → distribution stays on its *.cloudfront.net domain.
    const useDomain = !!(props.domainNames?.length && props.certificateArn);
    const certificate = useDomain
      ? acm.Certificate.fromCertificateArn(this, "SiteCert", props.certificateArn!)
      : undefined;

    this.distribution = new cloudfront.Distribution(this, "SiteDistribution", {
      comment: `${APP_NAME}-${cfg.stage} marketing site`,
      ...(useDomain ? { domainNames: props.domainNames, certificate } : {}),
      defaultRootObject: "index.html",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // NA + EU — cheapest.
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      // SPA client routing: unknown keys fall through to index.html.
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(5),
        },
      ],
    });

    const dist = path.resolve(__dirname, "..", "..", "marketing", "dist");

    // Content-hashed bundles (assets/index-<hash>.js|css) never change under a
    // given name → cache them for a year, immutable. Scoped include/exclude so
    // prune only removes stale hashed files, never index.html or images.
    new s3deploy.BucketDeployment(this, "DeployAssets", {
      sources: [s3deploy.Source.asset(dist)],
      destinationBucket: this.bucket,
      include: ["assets/*"],
      exclude: ["*"],
      prune: true,
      cacheControl: [
        s3deploy.CacheControl.setPublic(),
        s3deploy.CacheControl.maxAge(Duration.days(365)),
        s3deploy.CacheControl.immutable(),
      ],
    });

    // index.html, favicon, images, opengraph — unhashed names, so keep the
    // browser cache short (edge is invalidated on every deploy anyway) so new
    // deploys and image swaps surface quickly. This deployment owns the
    // CloudFront invalidation.
    new s3deploy.BucketDeployment(this, "DeployRoot", {
      sources: [s3deploy.Source.asset(dist)],
      destinationBucket: this.bucket,
      exclude: ["assets/*"],
      prune: true,
      distribution: this.distribution,
      distributionPaths: ["/*"],
      cacheControl: [
        s3deploy.CacheControl.setPublic(),
        s3deploy.CacheControl.maxAge(Duration.minutes(5)),
        s3deploy.CacheControl.mustRevalidate(),
      ],
    });

    new CfnOutput(this, "SiteUrl", {
      value: `https://${this.distribution.distributionDomainName}`,
      description: "Public CloudFront URL for the marketing site",
    });
    new CfnOutput(this, "DistributionId", {
      value: this.distribution.distributionId,
      description: "CloudFront distribution id (for manual invalidations)",
    });
    new CfnOutput(this, "SiteBucketName", {
      value: this.bucket.bucketName,
      description: "Origin S3 bucket for the marketing site",
    });
  }
}
